import { useCallback, useEffect, useRef, useState } from "react";

import { fetchPage, loadPagePreset, savePage } from "./api";
import { presetFromHash } from "./pagePresets.js";

import PageRenderer from "./PageRenderer.jsx";

import EditorShell from "./components/EditorShell.jsx";

import useConfigHistory, { cloneConfig, configsEqual } from "./hooks/useConfigHistory.js";

import { cloneForPaste } from "./elementClipboard.js";
import { createElement, insertOffsetFromPointer } from "./elementFactory.js";
import { mergeElement } from "./elementDefaults.js";
import {
  alignChildrenInContainer,
  collectElementsByIds,
  findElementById,
  groupElements,
  insertIntoRoot,
  insertIntoRootMany,
  removeElementsFromTree,
  ungroupContainer,
  updateElementInTree,
  updateElementsInTree,
} from "./elementTree.js";

const AUTOSAVE_MS = 600;

function resolveTargetIds(elementId, selectedIds, selectedId) {
  if (elementId) return [elementId];
  if (selectedIds.length > 0) return selectedIds;
  if (selectedId) return [selectedId];
  return [];
}



export default function App() {

  const [config, setConfig] = useState(null);

  const [savedConfig, setSavedConfig] = useState(null);

  const [sessionBaseline, setSessionBaseline] = useState(null);

  const [editMode, setEditMode] = useState(false);

  const [selectedIds, setSelectedIds] = useState([]);

  const [saveStatus, setSaveStatus] = useState("idle");

  const [toast, setToast] = useState(null);

  const [pagePreset, setPagePreset] = useState("demo");

  const history = useConfigHistory();

  const configRef = useRef(null);

  const continuousEditRef = useRef(false);

  const clipboardRef = useRef(null);

  const lastPointerRef = useRef(null);
  const pageRef = useRef(null);
  const pagePresetRef = useRef("demo");
  const [hasClipboard, setHasClipboard] = useState(false);



  configRef.current = config;
  pagePresetRef.current = pagePreset;

  const selectedId = selectedIds[selectedIds.length - 1] ?? null;



  useEffect(() => {

    let cancelled = false;

    async function init() {
      const hashPreset = presetFromHash();

      try {
        const data = await fetchPage();
        if (cancelled) return;

        if (data.preset !== hashPreset) {
          const loaded = await loadPagePreset(hashPreset);
          if (cancelled) return;
          setConfig(loaded.config);
          setSavedConfig(cloneConfig(loaded.config));
          setPagePreset(loaded.preset);
          return;
        }

        setConfig(data.config);
        setSavedConfig(cloneConfig(data.config));
        setPagePreset(data.preset ?? "demo");
      } catch {
        if (!cancelled) setToast("Could not load page. Is the server running?");
      }
    }

    init();

    return () => {
      cancelled = true;
    };

  }, []);



  useEffect(() => {

    const onHashChange = () => {
      const preset = presetFromHash();
      if (preset === pagePresetRef.current) return;

      loadPagePreset(preset)
        .then(({ config: loaded, preset: loadedPreset }) => {
          setEditMode(false);
          setSelectedIds([]);
          setSessionBaseline(null);
          history.clear();
          setSaveStatus("idle");
          setConfig(loaded);
          setSavedConfig(cloneConfig(loaded));
          setPagePreset(loadedPreset);
        })
        .catch(() => setToast("Could not switch page preset."));
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);

  }, [history]);



  const handleSwitchPreset = (_presetId, hash) => {
    if (window.location.hash === hash) return;
    window.location.hash = hash;
  };



  useEffect(() => {

    if (!editMode || !config || savedConfig === null) return;

    if (configsEqual(config, savedConfig)) return;



    setSaveStatus("saving");

    const timer = setTimeout(async () => {

      try {

        await savePage(config);

        setSavedConfig(cloneConfig(config));

        setSaveStatus("saved");

      } catch {

        setSaveStatus("error");

      }

    }, AUTOSAVE_MS);



    return () => clearTimeout(timer);

  }, [config, editMode, savedConfig]);



  const beginContinuousEdit = useCallback(() => {

    if (continuousEditRef.current || !configRef.current) return;

    continuousEditRef.current = true;

    history.push(configRef.current);

  }, [history]);



  const endContinuousEdit = useCallback(() => {

    continuousEditRef.current = false;

  }, []);



  const updateElement = useCallback(

    (id, changes) => {

      setConfig((prev) => {

        if (!continuousEditRef.current) {

          history.push(prev);

        }

        return {
          ...prev,
          elements: updateElementInTree(prev.elements, id, changes),
        };

      });

    },

    [history]

  );



  const updateElements = useCallback(

    (updates) => {

      setConfig((prev) => {

        if (!continuousEditRef.current) {

          history.push(prev);

        }

        const byId = Object.fromEntries(updates.map((u) => [u.id, u]));

        return {
          ...prev,
          elements: updateElementsInTree(prev.elements, updates),
        };

      });

    },

    [history]

  );



  const insertElement = useCallback(

    (element, afterId) => {

      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return { ...prev, elements: insertIntoRoot(prev.elements, element, afterId) };

      });

      setSelectedIds([element.id]);

    },

    [history, endContinuousEdit]

  );



  const handleSelect = useCallback((id, { additive = false } = {}) => {

    setSelectedIds((prev) => {

      if (!additive) return [id];

      if (prev.includes(id)) {

        const next = prev.filter((x) => x !== id);

        return next.length > 0 ? next : [id];

      }

      return [...prev, id];

    });

  }, []);



  const handleSelectMany = useCallback((ids, { additive = false } = {}) => {

    const unique = [...new Set(ids)];

    if (!unique.length) {

      setSelectedIds([]);

      return;

    }

    setSelectedIds((prev) => {

      if (!additive) return unique;

      const next = new Set(prev);

      for (const id of unique) next.add(id);

      return [...next];

    });

  }, []);



  const handleClearSelection = useCallback(() => {

    setSelectedIds([]);

  }, []);



  const handleCopy = useCallback(

    (elementId, anchorPoint) => {

      const ids = elementId

        ? [elementId]

        : selectedIds.length > 0

          ? selectedIds

          : selectedId

            ? [selectedId]

            : [];

      if (!ids.length || !configRef.current) return;



      const elements = collectElementsByIds(configRef.current.elements, ids);

      if (!elements.length) return;



      const anchor =

        anchorPoint ??

        lastPointerRef.current ?? {

          x: window.innerWidth / 2,

          y: window.innerHeight / 2,

        };

      clipboardRef.current = {

        elements: elements.map((el) => structuredClone(el)),

        anchor,

      };

      setHasClipboard(true);

    },

    [selectedId, selectedIds]

  );



  const handleCut = useCallback(

    (elementId, anchorPoint) => {

      const ids = elementId

        ? [elementId]

        : selectedIds.length > 0

          ? selectedIds

          : selectedId

            ? [selectedId]

            : [];

      if (!ids.length || !configRef.current) return;



      const remove = new Set(ids);

      const cutElements = collectElementsByIds(configRef.current.elements, ids).map((el) =>
        structuredClone(el)
      );

      if (!cutElements.length) return;



      const anchor =

        anchorPoint ??

        lastPointerRef.current ?? {

          x: window.innerWidth / 2,

          y: window.innerHeight / 2,

        };



      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return {
          ...prev,
          elements: removeElementsFromTree(prev.elements, [...remove]),
        };

      });

      clipboardRef.current = { elements: cutElements, anchor };

      setHasClipboard(true);

      setSelectedIds([]);

    },

    [selectedId, selectedIds, history, endContinuousEdit]

  );



  const handlePaste = useCallback(

    (afterId, pastePoint) => {

      if (!clipboardRef.current || !configRef.current) return;



      const sources =

        clipboardRef.current.elements ??

        (clipboardRef.current.element ? [clipboardRef.current.element] : []);

      if (!sources.length) return;



      const { anchor } = clipboardRef.current;

      const paste =

        pastePoint ??

        lastPointerRef.current ?? {

          x: anchor.x + 24,

          y: anchor.y + 24,

        };



      const copies = sources.map((source) => cloneForPaste(source, paste, anchor));

      const anchorId = afterId ?? selectedId ?? sources[sources.length - 1].id;



      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return {
          ...prev,
          elements: insertIntoRootMany(prev.elements, copies, anchorId),
        };

      });

      setSelectedIds(copies.map((copy) => copy.id));

    },

    [selectedId, history, endContinuousEdit]

  );



  const handleDuplicate = useCallback(

    (elementId) => {

      const id = elementId ?? selectedId;

      if (!id || !configRef.current) return;

      const el = findElementById(configRef.current.elements, id);

      if (!el) return;

      const copy = cloneForPaste(el);

      insertElement(copy, id);

    },

    [insertElement, selectedId]

  );



  const handleInsert = useCallback(

    (type) => {

      const { offsetX, offsetY } = insertOffsetFromPointer(

        pageRef.current,

        lastPointerRef.current

      );

      const element = createElement(type, { offsetX, offsetY });

      insertElement(element, selectedId);

    },

    [insertElement, selectedId]

  );



  const handleDelete = useCallback(

    (elementId) => {

      const ids = resolveTargetIds(elementId, selectedIds, selectedId);

      if (!ids.length || !configRef.current) return;



      const remove = new Set(ids);

      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return {
          ...prev,
          elements: removeElementsFromTree(prev.elements, [...remove]),
        };

      });

      setSelectedIds([]);

    },

    [selectedId, selectedIds, history, endContinuousEdit]

  );



  const handleNudge = useCallback(

    (dx, dy) => {

      if (!selectedIds.length || !configRef.current) return;



      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        const move = new Set(selectedIds);

        return {
          ...prev,
          elements: updateElementsInTree(
            prev.elements,
            selectedIds.map((id) => {
              const el = findElementById(prev.elements, id);
              if (!el) return { id, offsetX: 0, offsetY: 0 };
              const merged = mergeElement(el);
              return {
                id,
                offsetX: merged.offsetX + dx,
                offsetY: merged.offsetY + dy,
              };
            })
          ),
        };

      });

    },

    [selectedIds, history, endContinuousEdit]

  );



  const handleGroup = useCallback(() => {
    if (selectedIds.length < 2 || !configRef.current) return;
    endContinuousEdit();
    const prev = configRef.current;
    history.push(prev);
    const next = groupElements(prev.elements, selectedIds);
    const newContainer = next.find(
      (el) => el.type === "container" && !findElementById(prev.elements, el.id)
    );
    setConfig({ ...prev, elements: next });
    if (newContainer) setSelectedIds([newContainer.id]);
  }, [selectedIds, history, endContinuousEdit]);

  const handleUngroup = useCallback(() => {
    if (selectedIds.length !== 1 || !configRef.current) return;
    const id = selectedIds[0];
    const el = findElementById(configRef.current.elements, id);
    if (!el || el.type !== "container") return;
    endContinuousEdit();
    const prev = configRef.current;
    history.push(prev);
    const childIds = (mergeElement(el).children ?? []).map((c) => c.id);
    const next = ungroupContainer(prev.elements, id);
    setConfig({ ...prev, elements: next });
    setSelectedIds(childIds.length ? childIds : []);
  }, [selectedIds, history, endContinuousEdit]);

  const handleAlignChildren = useCallback(
    (containerId, horizontal, vertical) => {
      endContinuousEdit();
      setConfig((prev) => {
        history.push(prev);
        const target = findElementById(prev.elements, containerId);
        if (!target) return prev;
        const aligned = alignChildrenInContainer(target, horizontal, vertical);
        return {
          ...prev,
          elements: updateElementInTree(prev.elements, containerId, {
            children: aligned.children,
          }),
        };
      });
    },
    [history, endContinuousEdit]
  );

  const handleEdit = () => {

    if (config) {

      const baseline = cloneConfig(config);

      setSessionBaseline(baseline);

    }

    history.clear();

    setSaveStatus("saved");

    setEditMode(true);

  };



  const handleUndo = useCallback(() => {

    endContinuousEdit();

    setConfig((current) => history.undo(current) ?? current);

  }, [history, endContinuousEdit]);



  const handleRedo = useCallback(() => {

    endContinuousEdit();

    setConfig((current) => history.redo(current) ?? current);

  }, [history, endContinuousEdit]);



  useEffect(() => {

    if (!editMode) return;



    const onKeyDown = (e) => {

      const target = e.target;

      const isTyping =

        target instanceof HTMLInputElement ||

        target instanceof HTMLTextAreaElement ||

        target.isContentEditable;



      const mod = e.ctrlKey || e.metaKey;

      if (!mod) return;



      if (e.key === "z" && !e.shiftKey) {

        if (isTyping) return;

        e.preventDefault();

        handleUndo();

        return;

      }



      if (e.key === "y" || (e.key === "z" && e.shiftKey) || (e.key === "Z" && e.shiftKey)) {

        if (isTyping) return;

        e.preventDefault();

        handleRedo();

        return;

      }



      if (isTyping) return;



      if (e.key === "c" || e.key === "C") {

        e.preventDefault();

        handleCopy();

        return;

      }



      if (e.key === "x" || e.key === "X") {

        e.preventDefault();

        handleCut();

        return;

      }



      if (e.key === "v" || e.key === "V") {

        if (!hasClipboard) return;

        e.preventDefault();

        handlePaste();

        return;

      }



      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        handleDuplicate();
        return;
      }

      if (e.key === "g" || e.key === "G") {
        if (isTyping) return;
        e.preventDefault();
        if (e.shiftKey) handleUngroup();
        else handleGroup();
      }
    };



    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [
    editMode,
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    handleGroup,
    handleUngroup,
    hasClipboard,
  ]);



  useEffect(() => {

    if (!editMode) return;



    const onKeyDown = (e) => {

      const target = e.target;

      const isTyping =

        target instanceof HTMLInputElement ||

        target instanceof HTMLTextAreaElement ||

        target.isContentEditable;

      if (isTyping) return;



      if (e.key === "Delete" || e.key === "Backspace") {

        if (selectedIds.length === 0) return;

        e.preventDefault();

        handleDelete();

        return;

      }



      const nudge = {

        ArrowLeft: [-1, 0],

        ArrowRight: [1, 0],

        ArrowUp: [0, -1],

        ArrowDown: [0, 1],

      }[e.key];

      if (nudge) {

        if (selectedIds.length === 0) return;

        e.preventDefault();

        const step = e.shiftKey ? 10 : 1;

        handleNudge(nudge[0] * step, nudge[1] * step);

      }

    };



    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [editMode, selectedIds, handleDelete, handleNudge]);



  const handleRevert = () => {

    if (!sessionBaseline || configsEqual(config, sessionBaseline)) return;

    endContinuousEdit();

    history.push(config);

    setConfig(cloneConfig(sessionBaseline));

  };



  const handleDone = () => {

    endContinuousEdit();

    setEditMode(false);

    setSelectedIds([]);

    setSessionBaseline(null);

    history.clear();

    setSaveStatus("idle");

  };



  if (!config) {

    return <div className="page-loading">Loading…</div>;

  }



  const selected =
    selectedIds.length === 1
      ? findElementById(config.elements, selectedId)
      : null;

  const selectionCount = selectedIds.length;

  const canRevert =

    sessionBaseline !== null && !configsEqual(config, sessionBaseline);



  return (

    <EditorShell

      editMode={editMode}

      saveStatus={saveStatus}

      canUndo={history.canUndo}

      canRedo={history.canRedo}

      canRevert={canRevert}

      pagePreset={pagePreset}

      onSwitchPreset={handleSwitchPreset}

      selected={selected}

      selectionCount={selectionCount}

      onEdit={handleEdit}

      onUndo={handleUndo}

      onRedo={handleRedo}

      onRevert={handleRevert}

      onDone={handleDone}

      onInsert={handleInsert}

      onElementChange={updateElement}

      onAlignChildren={handleAlignChildren}

      onBeginContinuousEdit={beginContinuousEdit}

      onEndContinuousEdit={endContinuousEdit}

      toast={toast}

    >

      <PageRenderer

        config={config}

        pagePreset={pagePreset}

        editMode={editMode}

        selectedIds={selectedIds}

        onSelect={handleSelect}

        onSelectMany={handleSelectMany}

        onClearSelection={handleClearSelection}

        onElementChange={updateElement}

        onElementsChange={updateElements}

        onBeginContinuousEdit={beginContinuousEdit}

        onEndContinuousEdit={endContinuousEdit}

        hasClipboard={hasClipboard}

        onCopy={handleCopy}

        onCut={handleCut}

        onPaste={handlePaste}

        onDuplicate={handleDuplicate}

        onDelete={handleDelete}

        lastPointerRef={lastPointerRef}

        pageRef={pageRef}

      />

    </EditorShell>

  );

}

