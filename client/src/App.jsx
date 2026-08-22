import { useCallback, useEffect, useRef, useState } from "react";

import { fetchPage, loadPagePreset, savePage } from "./api";
import { hashForPreset, presetFromHash } from "./pagePresets.js";

import PageRenderer from "./PageRenderer.jsx";

import EditorShell from "./components/EditorShell.jsx";

import useConfigHistory, { cloneConfig, configsEqual } from "./hooks/useConfigHistory.js";

import { cloneForPaste } from "./elementClipboard.js";
import { applyStackNudgeToCopies, PASTE_CURSOR_NUDGE, PASTE_STEP_OFFSET } from "./elementPlacement.js";
import { createElement, viewportCenterClientPoint } from "./elementFactory.js";
import { mergeElement, mergeConfig } from "./elementDefaults.js";
import {
  alignChildrenInContainer,
  alignSelectedElements,
  collectElementsByIds,
  distributeSelectedElements,
  findElementById,
  insertIntoTree,
  insertIntoRootMany,
  isElementLocked,
  moveElementBefore,
  nudgeElements,
  removeElementsFromTree,
  reparentAndGroup,
  shiftZOrder,
  setZOrderExtreme,
  ungroupContainer,
  updateElementInTree,
  updateElementsInTree,
  BreakpointContext,
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

  const [pageSelected, setPageSelected] = useState(false);

  const history = useConfigHistory();

  const configRef = useRef(null);

  const continuousEditRef = useRef(false);

  const clipboardRef = useRef(null);
  const stackGenerationRef = useRef({});

  const stackKey = (sourceIds) => [...sourceIds].sort().join("|");

  const bumpStackGeneration = useCallback((sourceIds) => {
    const key = stackKey(sourceIds);
    const next = (stackGenerationRef.current[key] ?? 0) + 1;
    stackGenerationRef.current[key] = next;
    return next;
  }, []);

  const resetStackGeneration = useCallback((sourceIds) => {
    delete stackGenerationRef.current[stackKey(sourceIds)];
  }, []);

  const lastPointerRef = useRef(null);
  const pageRef = useRef(null);
  const canvasRef = useRef(null);
  const placementApiRef = useRef(null);

  const [placementJob, setPlacementJob] = useState(null);
  const pendingHistorySnapshotRef = useRef(null);
  const pagePresetRef = useRef("demo");
  const [hasClipboard, setHasClipboard] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSnapEnabled, setGridSnapEnabled] = useState(false);
  const [snapshotsOpen, setSnapshotsOpen] = useState(false);
  const [assetsOpen, setAssetsOpen] = useState(false);

  const [activeBp, setActiveBp] = useState("base");



  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  configRef.current = config;
  pagePresetRef.current = pagePreset;

  const selectedId = selectedIds[selectedIds.length - 1] ?? null;



  useEffect(() => {

    let cancelled = false;

    async function init() {
      try {
        const data = await fetchPage();
        if (cancelled) return;

        const savedPreset = data.preset ?? "demo";
        const hashPreset = presetFromHash();

        // Restore last saved config. Sync URL to saved preset — opening `/` must not wipe edits.
        if (savedPreset !== hashPreset) {
          window.history.replaceState(null, "", hashForPreset(savedPreset));
        }

        setConfig(mergeConfig(data.config));
        setSavedConfig(cloneConfig(mergeConfig(data.config)));
        setPagePreset(savedPreset);
      } catch {
        if (!cancelled) showToast("Could not load page. Is the server running?");
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
        .then(({ config: loaded, preset: loadedPreset, htmlWriteError }) => {
          setEditMode(false);
          setSelectedIds([]);
          setSessionBaseline(null);
          history.clear();
          setSaveStatus(htmlWriteError ? "html-error" : "idle");
          setConfig(mergeConfig(loaded));
          setSavedConfig(cloneConfig(mergeConfig(loaded)));
          setPagePreset(loadedPreset);
          setPageSelected(false);
          setSnapshotsOpen(false);
          setAssetsOpen(false);
        })
        .catch(() => showToast("Could not switch page preset."));
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

        const result = await savePage(config);

        setSavedConfig(cloneConfig(config));

        setSaveStatus(result.htmlWriteError ? "html-error" : "saved");

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

    (element, { parentId = null, afterId = null, recordHistory = true } = {}) => {

      endContinuousEdit();

      setConfig((prev) => {

        if (recordHistory) history.push(prev);

        return {
          ...mergeConfig(prev),
          elements: insertIntoTree(prev.elements, element, { parentId, afterId }),
        };

      });

      setSelectedIds([element.id]);
      setPageSelected(false);

    },

    [history, endContinuousEdit]

  );



  const commitPendingHistory = useCallback(() => {

    if (!pendingHistorySnapshotRef.current) return;

    history.push(pendingHistorySnapshotRef.current);

    pendingHistorySnapshotRef.current = null;

  }, [history]);



  const applyPlacementOffsets = useCallback((updates) => {

    setConfig((prev) => {

      if (pendingHistorySnapshotRef.current) {

        history.push(pendingHistorySnapshotRef.current);

        pendingHistorySnapshotRef.current = null;

      }

      if (!updates.length) return prev;

      return {

        ...prev,

        elements: updateElementsInTree(prev.elements, updates),

      };

    });

  }, [history]);



  const finishPlacement = useCallback(() => {

    commitPendingHistory();

    setPlacementJob(null);

  }, [commitPendingHistory]);



  const handleSelect = useCallback((id, { additive = false } = {}) => {

    if (configRef.current && isElementLocked(configRef.current.elements, id)) return;

    setPageSelected(false);

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
    setPageSelected(true);

  }, []);



  const handleSelectPage = useCallback(() => {

    setSelectedIds([]);
    setPageSelected(true);

  }, []);



  const handlePageChange = useCallback(

    (patch) => {

      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return { ...mergeConfig(prev), ...patch };

      });

    },

    [history, endContinuousEdit]

  );



  const handleToggleHidden = useCallback(

    (id) => {

      endContinuousEdit();

      setSelectedIds((prev) => prev.filter((x) => x !== id));

      setConfig((prev) => {

        history.push(prev);

        const el = findElementById(prev.elements, id);

        if (!el) return prev;

        return {
          ...prev,
          elements: updateElementInTree(prev.elements, id, {
            hidden: !mergeElement(el).hidden,
          }),
        };

      });

    },

    [history, endContinuousEdit]

  );



  const handleToggleLock = useCallback(

    (id) => {

      endContinuousEdit();

      setSelectedIds((prev) => prev.filter((x) => x !== id));

      setConfig((prev) => {

        history.push(prev);

        const el = findElementById(prev.elements, id);

        if (!el) return prev;

        return {
          ...prev,
          elements: updateElementInTree(prev.elements, id, {
            locked: !mergeElement(el).locked,
          }),
        };

      });

    },

    [history, endContinuousEdit]

  );



  const handleLayerOrder = useCallback(

    (action, targetId = null) => {

      const ids = targetId
        ? [targetId]
        : selectedIds.length
          ? selectedIds
          : selectedId
            ? [selectedId]
            : [];

      if (!ids.length || !configRef.current) return;

      const unlocked = ids.filter((id) => !isElementLocked(configRef.current.elements, id));

      if (!unlocked.length) return;

      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        let next = prev.elements;

        const ordered = action === "back" ? [...unlocked].reverse() : unlocked;

        for (const id of ordered) {

          if (action === "forward") next = shiftZOrder(next, id, 1);

          else if (action === "backward") next = shiftZOrder(next, id, -1);

          else if (action === "front") next = setZOrderExtreme(next, id, "front");

          else if (action === "back") next = setZOrderExtreme(next, id, "back");

        }

        return { ...prev, elements: next };

      });

    },

    [selectedIds, selectedId, history, endContinuousEdit]

  );



  const handleRenameLayer = useCallback(

    (id, name) => {

      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return {
          ...prev,
          elements: updateElementInTree(prev.elements, id, { name }),
        };

      });

    },

    [history, endContinuousEdit]

  );



  const handleMoveLayerBefore = useCallback(

    (dragId, targetId) => {

      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return {
          ...prev,
          elements: moveElementBefore(prev.elements, dragId, targetId),
        };

      });

    },

    [history, endContinuousEdit]

  );



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



      const visualRelatives =

        placementApiRef.current?.captureVisualRelatives(ids) ?? {};

      const anchorClient =

        placementApiRef.current?.getGroupOriginClientPoint(ids) ?? null;



      clipboardRef.current = {

        elements: elements.map((el) => structuredClone(el)),

        visualRelatives,

        anchorClient,

        sourceIds: ids,

        isCut: false,

      };

      resetStackGeneration(ids);

      setHasClipboard(true);

    },

    [selectedId, selectedIds, resetStackGeneration]

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



      const visualRelatives =

        placementApiRef.current?.captureVisualRelatives(ids) ?? {};

      const anchorClient =

        placementApiRef.current?.getGroupOriginClientPoint(ids) ?? null;



      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return {
          ...prev,
          elements: removeElementsFromTree(prev.elements, [...remove]),
        };

      });

      clipboardRef.current = {
        elements: cutElements,
        visualRelatives,
        anchorClient,
        sourceIds: ids,
        isCut: true,
      };

      resetStackGeneration(ids);

      setHasClipboard(true);

      setSelectedIds([]);

      setPageSelected(true);

    },

    [selectedId, selectedIds, history, endContinuousEdit, resetStackGeneration]

  );



  const handlePaste = useCallback(

    (afterId, pastePoint) => {

      if (!clipboardRef.current || !configRef.current) return;



      const sources =

        clipboardRef.current.elements ??

        (clipboardRef.current.element ? [clipboardRef.current.element] : []);

      if (!sources.length) return;

      const clipboard = clipboardRef.current;
      const sourceIds = clipboard.sourceIds ?? [];
      const pointer = pastePoint ?? lastPointerRef.current ?? null;
      const inFrame =
        !clipboard.isCut &&
        pointer &&
        sourceIds.length > 0 &&
        placementApiRef.current?.isPointInElementsFrame(pointer, sourceIds);

      const copies = sources.map((source) => cloneForPaste(source));
      const anchorId = afterId ?? selectedId ?? sources[sources.length - 1].id;

      endContinuousEdit();

      if (inFrame) {
        const generation = bumpStackGeneration(sourceIds);
        applyStackNudgeToCopies(sources, copies, generation);

        setConfig((prev) => {
          history.push(prev);
          let elements = insertIntoRootMany(prev.elements, copies, anchorId);
          for (const copy of copies) {
            elements = setZOrderExtreme(elements, copy.id, "front");
          }
          return { ...prev, elements };
        });

        setSelectedIds(copies.map((copy) => copy.id));
        return;
      }

      let anchorClient;

      if (pastePoint) {
        // Context-menu paste: land near the right-click point.
        anchorClient = {
          x: pastePoint.x + PASTE_CURSOR_NUDGE,
          y: pastePoint.y + PASTE_CURSOR_NUDGE,
        };
      } else {
        // Keyboard paste: always anchor to the current viewport position so
        // the element appears where the user is looking regardless of where
        // the source was when it was copied/cut, and regardless of how many
        // times paste has been repeated. Each successive paste nudges
        // down-right from the current pointer rather than accumulating from
        // the original copy position (which goes off-screen after a few steps).
        const generation = bumpStackGeneration(sourceIds);
        const base =
          lastPointerRef.current ?? viewportCenterClientPoint(canvasRef.current);
        anchorClient = {
          x: base.x + PASTE_STEP_OFFSET * (generation - 1) + PASTE_CURSOR_NUDGE,
          y: base.y + PASTE_STEP_OFFSET * (generation - 1) + PASTE_CURSOR_NUDGE,
        };
      }

      const visualRelatives = clipboard.visualRelatives ?? {};
      const copyRelatives = {};

      sources.forEach((source, index) => {
        copyRelatives[copies[index].id] = visualRelatives[source.id] ?? { x: 0, y: 0 };
      });

      pendingHistorySnapshotRef.current = cloneConfig(configRef.current);

      setConfig((prev) => ({
        ...prev,
        elements: insertIntoRootMany(prev.elements, copies, anchorId),
      }));

      setSelectedIds(copies.map((copy) => copy.id));

      setPlacementJob({
        ids: copies.map((copy) => copy.id),
        anchorClient,
        visualRelatives: copyRelatives,
        originOffset: 0,
      });
    },

    [selectedId, history, endContinuousEdit, bumpStackGeneration]

  );



  const handleDuplicate = useCallback(

    (elementId) => {

      const id = elementId ?? selectedId;

      if (!id || !configRef.current) return;

      const el = findElementById(configRef.current.elements, id);

      if (!el) return;

      const copy = cloneForPaste(el);
      const pointer = lastPointerRef.current;
      const inFrame =
        pointer && placementApiRef.current?.isPointInElementsFrame(pointer, [id]);

      endContinuousEdit();

      if (inFrame) {
        const generation = bumpStackGeneration([id]);
        applyStackNudgeToCopies([el], [copy], generation);

        setConfig((prev) => {
          history.push(prev);
          let elements = insertIntoTree(prev.elements, copy, { afterId: id });
          elements = setZOrderExtreme(elements, copy.id, "front");
          return { ...prev, elements };
        });

        setSelectedIds([copy.id]);
        setPageSelected(false);
        return;
      }

      pendingHistorySnapshotRef.current = cloneConfig(configRef.current);

      insertElement(copy, { afterId: id, recordHistory: false });

      const sourceVisual = placementApiRef.current?.getElementClientPoint(id);

      setPlacementJob({

        ids: [copy.id],

        anchorClient: sourceVisual

          ? { x: sourceVisual.x + 24, y: sourceVisual.y + 24 }

          : viewportCenterClientPoint(canvasRef.current),

        visualRelatives: { [copy.id]: { x: 0, y: 0 } },

        originOffset: 0,

      });

    },

    [insertElement, selectedId, history, endContinuousEdit, bumpStackGeneration]

  );



  const handleInsert = useCallback(

    (type) => {

      let parentId = null;
      let afterId = null;

      if (selectedIds.length === 1 && configRef.current) {

        const sel = findElementById(configRef.current.elements, selectedIds[0]);

        if (sel?.type === "container") {

          parentId = sel.id;

        } else {

          afterId = selectedIds[0];

        }

      }

      const element = createElement(type, { offsetX: 0, offsetY: 0 });

      pendingHistorySnapshotRef.current = cloneConfig(configRef.current);

      insertElement(element, { parentId, afterId, recordHistory: false });

      setPlacementJob({

        ids: [element.id],

        anchorClient: viewportCenterClientPoint(canvasRef.current),

        visualRelatives: { [element.id]: { x: 0, y: 0 } },

      });

    },

    [insertElement, selectedIds]

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
    (dx, dy, { step = 1, ids = selectedIds } = {}) => {
      if (!ids.length || !configRef.current) return;

      const movable = ids.filter((id) => !isElementLocked(configRef.current.elements, id));
      if (!movable.length) return;

      endContinuousEdit();

      setConfig((prev) => {
        history.push(prev);
        return {
          ...prev,
          elements: nudgeElements(prev.elements, movable, dx * step, dy * step, {
            snapEnabled,
            gridSnapEnabled,
          }),
        };
      });
    },
    [selectedIds, history, endContinuousEdit, snapEnabled, gridSnapEnabled]
  );



  const handleGroup = useCallback(() => {
    if (selectedIds.length < 2 || !configRef.current) return;
    endContinuousEdit();
    const prev = configRef.current;
    history.push(prev);
    const { elements: next, containerId } = reparentAndGroup(prev.elements, selectedIds);
    setConfig({ ...prev, elements: next });
    if (containerId) setSelectedIds([containerId]);
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

  const handleAlign = useCallback(
    (horizontal, vertical) => {
      const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
      if (!ids.length || !configRef.current) return;
      if (!horizontal && !vertical) return;
      endContinuousEdit();
      setConfig((prev) => {
        history.push(prev);
        return {
          ...prev,
          elements: alignSelectedElements(prev.elements, ids, { horizontal, vertical }),
        };
      });
    },
    [selectedIds, selectedId, history, endContinuousEdit]
  );

  const handleDistribute = useCallback(
    (axis) => {
      const ids = selectedIds.length ? selectedIds : [];
      if (ids.length < 3 || !configRef.current) return;
      endContinuousEdit();
      setConfig((prev) => {
        history.push(prev);
        return {
          ...prev,
          elements: distributeSelectedElements(prev.elements, ids, axis),
        };
      });
    },
    [selectedIds, history, endContinuousEdit]
  );

  const handleEdit = () => {

    if (config) {

      const baseline = cloneConfig(config);

      setSessionBaseline(baseline);

    }

    history.clear();

    setSaveStatus("saved");

    setSelectedIds([]);

    setPageSelected(true);

    setEditMode(true);

  };



  const handleUndo = useCallback(() => {

    endContinuousEdit();

    pendingHistorySnapshotRef.current = null;

    setPlacementJob(null);

    const restored = history.undo(configRef.current);

    if (!restored) return;

    setConfig(restored);

    setSelectedIds((ids) => ids.filter((id) => findElementById(restored.elements, id)));

  }, [history, endContinuousEdit]);



  const handleRedo = useCallback(() => {

    endContinuousEdit();

    pendingHistorySnapshotRef.current = null;

    setPlacementJob(null);

    const next = history.redo(configRef.current);

    if (!next) return;

    setConfig(next);

    setSelectedIds((ids) => ids.filter((id) => findElementById(next.elements, id)));

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

      // Use e.code — Shift+] is "}" on US layouts, not "]".
      if (e.code === "BracketRight") {
        e.preventDefault();
        handleLayerOrder(e.shiftKey ? "front" : "forward");
        return;
      }

      if (e.code === "BracketLeft") {
        e.preventDefault();
        handleLayerOrder(e.shiftKey ? "back" : "backward");
        return;
      }

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
    handleLayerOrder,
    hasClipboard,
  ]);

  useEffect(() => {
    if (!editMode) return;
    const onPointerMove = (e) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, [editMode]);



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

        const movable = selectedIds.filter(
          (id) => !isElementLocked(configRef.current?.elements ?? [], id)
        );

        if (movable.length === 0) return;

        e.preventDefault();

        const baseStep = gridSnapEnabled ? 8 : 1;
        const step = e.shiftKey ? baseStep * 10 : baseStep;

        handleNudge(nudge[0], nudge[1], { step, ids: movable });

        return;
      }

    };



    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);

  }, [editMode, selectedIds, handleDelete, handleNudge, gridSnapEnabled]);



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

    setPageSelected(false);

    setSessionBaseline(null);

    history.clear();

    setSaveStatus("idle");

  };



  const handleToggleSnapshots = useCallback((force) => {
    setSnapshotsOpen((open) => {
      const next = force !== undefined ? force : !open;
      if (next) setAssetsOpen(false);
      return next;
    });
  }, []);

  const handleToggleAssets = useCallback((force) => {
    setAssetsOpen((open) => {
      const next = force !== undefined ? force : !open;
      if (next) setSnapshotsOpen(false);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    if (!configRef.current) return;
    const blob = new Blob([JSON.stringify(configRef.current, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `page-${pagePresetRef.current}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(
    async (file) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.elements)) {
          throw new Error("Invalid config: must include elements[]");
        }
        const merged = mergeConfig(parsed);
        if (configRef.current) {
          history.push(configRef.current);
        }
        setConfig(merged);
        setSelectedIds([]);
        setPageSelected(false);
        setSaveStatus("idle");
      } catch (err) {
        showToast(err.message ?? "Import failed");
      }
    },
    [history, showToast]
  );

  const handleSnapshotRestore = useCallback(
    (data) => {
      if (configRef.current) {
        history.push(configRef.current);
      }
      const merged = mergeConfig(data.config);
      setConfig(merged);
      setSavedConfig(cloneConfig(merged));
      const restoredPreset = data.preset ?? pagePresetRef.current;
      setPagePreset(restoredPreset);
      if (restoredPreset !== pagePresetRef.current) {
        window.history.replaceState(null, "", hashForPreset(restoredPreset));
      }
      setSaveStatus(data.htmlWriteError ? "html-error" : "saved");
      setSelectedIds([]);
      setPageSelected(false);
    },
    [history]
  );



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

  const canGroupSelection = selectedIds.length >= 2;
  const canUngroupSelection =
    selectedIds.length === 1 && selected?.type === "container";



  return (

    <BreakpointContext.Provider value={activeBp}>

    <EditorShell

      editMode={editMode}

      saveStatus={saveStatus}

      canUndo={history.canUndo}

      canRedo={history.canRedo}

      canRevert={canRevert}

      pagePreset={pagePreset}

      onSwitchPreset={handleSwitchPreset}

      config={config}

      selectedIds={selectedIds}

      pageSelected={pageSelected}

      onSelectPage={handleSelectPage}

      onSelectElement={handleSelect}

      onToggleHidden={handleToggleHidden}

      onToggleLock={handleToggleLock}

      onRenameLayer={handleRenameLayer}

      onMoveLayerBefore={handleMoveLayerBefore}

      onLayerOrder={handleLayerOrder}

      onPageChange={handlePageChange}

      selected={selected}

      selectionCount={selectionCount}

      onEdit={handleEdit}

      onUndo={handleUndo}

      onRedo={handleRedo}

      onRevert={handleRevert}

      onDone={handleDone}

      onInsert={handleInsert}

      canvasRef={canvasRef}

      lastPointerRef={lastPointerRef}

      onElementChange={updateElement}

      onAlignChildren={handleAlignChildren}

      onAlign={handleAlign}

      onDistribute={handleDistribute}

      snapEnabled={snapEnabled}

      onToggleSnap={() => setSnapEnabled((v) => !v)}

      gridSnapEnabled={gridSnapEnabled}

      onGridSnapChange={setGridSnapEnabled}

      onBeginContinuousEdit={beginContinuousEdit}

      onEndContinuousEdit={endContinuousEdit}

      snapshotsOpen={snapshotsOpen}
      onToggleSnapshots={handleToggleSnapshots}
      onSnapshotRestore={handleSnapshotRestore}
      assetsOpen={assetsOpen}
      onToggleAssets={handleToggleAssets}
      onExport={handleExport}
      onImport={handleImport}
      onPanelError={showToast}

      activeBp={activeBp}
      onBreakpointChange={setActiveBp}

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

        onGroup={handleGroup}

        onUngroup={handleUngroup}

        canGroup={canGroupSelection}

        canUngroup={canUngroupSelection}

        onLayerOrder={handleLayerOrder}

        lastPointerRef={lastPointerRef}

        pageRef={pageRef}

        canvasRef={canvasRef}

        placementApiRef={placementApiRef}

        placementJob={placementJob}

        onApplyPlacement={applyPlacementOffsets}

        onPlacementDone={finishPlacement}

        snapEnabled={snapEnabled}

        gridSnapEnabled={gridSnapEnabled}

        breakpoint={activeBp}

      />

    </EditorShell>

    </BreakpointContext.Provider>

  );

}

