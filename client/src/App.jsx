import { useCallback, useEffect, useRef, useState } from "react";

import { fetchPage, loadPagePreset, savePage } from "./api";
import { hashForPreset, presetFromHash } from "./pagePresets.js";
import { overlayFromSearch, parseOverlayMode, writeOverlaySearch } from "../../shared/overlay/modes.js";
import { getOverlay } from "../../shared/overlay/index.js";

import PageRenderer from "./PageRenderer.jsx";

import EditorShell from "./components/EditorShell.jsx";

import useConfigHistory, { cloneConfig, configsEqual } from "./hooks/useConfigHistory.js";

import { cloneForPaste } from "./elementClipboard.js";
import {
  applyStackNudgeToCopies,
  computeAtomicPasteOffsets,
  PASTE_CURSOR_NUDGE,
  PASTE_STEP_OFFSET,
  STACK_NUDGE,
  stampPasteOffset,
} from "./elementPlacement.js";
import { createElement, viewportCenterClientPoint } from "./elementFactory.js";
import { mergeElement, mergeConfig } from "./elementDefaults.js";
import {
  alignChildrenInContainer,
  alignMutableSelection,
  canCanvasGesture,
  canMutate,
  collectElementsByIds,
  distributeMutableSelection,
  filterCanvasSelection,
  findElementById,
  findParentId,
  groupMutableSelection,
  insertIntoTree,
  insertIntoTreeMany,
  moveElementBefore,
  mutableIds,
  nudgeElements,
  removeElementsFromTree,
  resolvePasteParent,
  selectionAfterToggleLock,
  shiftZOrder,
  setZOrderExtreme,
  ungroupMutableSelection,
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
  const [overlayMode, setOverlayMode] = useState(() =>
    typeof window === "undefined" ? "A" : overlayFromSearch(window.location.search)
  );
  const [gestureDraft, setGestureDraft] = useState(null);

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

  const handleOverlayMode = useCallback((mode) => {
    const next = parseOverlayMode(mode);
    setOverlayMode(next);
    window.history.replaceState(null, "", writeOverlaySearch(next));
  }, []);



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

    if (configRef.current && !canCanvasGesture(configRef.current.elements, id)) return;

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

    const unique = filterCanvasSelection(configRef.current?.elements ?? [], [...new Set(ids)]);

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

      setSelectedIds((prev) =>
        selectionAfterToggleLock(configRef.current?.elements ?? [], prev, id)
      );

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

      const unlocked = mutableIds(configRef.current.elements, ids);

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

      if (!canMutate(configRef.current?.elements ?? [], dragId)) return;

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

      const ids = mutableIds(
        configRef.current?.elements ?? [],
        resolveTargetIds(elementId, selectedIds, selectedId)
      );

      if (!ids.length || !configRef.current) return;

      const elements = collectElementsByIds(configRef.current.elements, ids);

      if (!elements.length) return;

      clipboardRef.current = {
        elements: elements.map((el) => structuredClone(el)),
        visualRelatives: placementApiRef.current?.captureVisualRelatives(ids) ?? {},
        sourceVisuals: placementApiRef.current?.captureVisualPagePoints(ids) ?? {},
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

      const ids = mutableIds(
        configRef.current?.elements ?? [],
        resolveTargetIds(elementId, selectedIds, selectedId)
      );

      if (!ids.length || !configRef.current) return;

      const cutElements = collectElementsByIds(configRef.current.elements, ids).map((el) =>
        structuredClone(el)
      );

      if (!cutElements.length) return;

      const visualRelatives = placementApiRef.current?.captureVisualRelatives(ids) ?? {};
      const sourceVisuals = placementApiRef.current?.captureVisualPagePoints(ids) ?? {};

      endContinuousEdit();

      setConfig((prev) => {

        history.push(prev);

        return {
          ...prev,
          elements: removeElementsFromTree(prev.elements, ids),
        };

      });

      clipboardRef.current = {
        elements: cutElements,
        visualRelatives,
        sourceVisuals,
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
      const overlay = getOverlay(overlayMode);
      const sourceIds = clipboard.sourceIds ?? [];
      const pointer = pastePoint ?? lastPointerRef.current ?? null;
      const selected = selectedIds;
      const treeTarget = afterId
        ? { parentId: findParentId(configRef.current.elements, afterId), afterId }
        : resolvePasteParent(configRef.current.elements, selected);
      const intoSelectedFrame =
        !afterId &&
        selected.length === 1 &&
        findElementById(configRef.current.elements, selected[0])?.type === "container" &&
        canMutate(configRef.current.elements, selected[0]);

      const copies = sources.map((source) => cloneForPaste(source));

      endContinuousEdit();

      const commitCopies = (parentId, insertAfter) => {
        setConfig((prev) => {
          history.push(prev);
          let elements = insertIntoTreeMany(prev.elements, copies, {
            parentId,
            afterId: insertAfter,
          });
          for (const copy of copies) {
            elements = setZOrderExtreme(elements, copy.id, "front");
          }
          return { ...prev, elements };
        });
        setSelectedIds(copies.map((copy) => copy.id));
      };

      if (intoSelectedFrame) {
        copies.forEach((copy, i) => {
          stampPasteOffset(overlay, copy, sources[i], {
            offsetX: STACK_NUDGE * (i + 1),
            offsetY: STACK_NUDGE * (i + 1),
          });
        });
        commitCopies(treeTarget.parentId, null);
        return;
      }

      const inFrame =
        !clipboard.isCut &&
        pointer &&
        sourceIds.length > 0 &&
        placementApiRef.current?.isPointInElementsFrame(pointer, sourceIds);

      if (inFrame) {
        const generation = bumpStackGeneration(sourceIds);
        applyStackNudgeToCopies(sources, copies, generation);
        copies.forEach((copy, i) => {
          stampPasteOffset(overlay, copy, sources[i], {
            offsetX: copy.offsetX,
            offsetY: copy.offsetY,
          });
        });
        commitCopies(treeTarget.parentId, treeTarget.afterId);
        return;
      }

      const generation = bumpStackGeneration(sourceIds);
      let anchorClient;
      if (pastePoint) {
        anchorClient = {
          x: pastePoint.x + PASTE_CURSOR_NUDGE,
          y: pastePoint.y + PASTE_CURSOR_NUDGE,
        };
      } else {
        const base =
          lastPointerRef.current ?? viewportCenterClientPoint(canvasRef.current);
        anchorClient = {
          x: base.x + PASTE_STEP_OFFSET * (generation - 1) + PASTE_CURSOR_NUDGE,
          y: base.y + PASTE_STEP_OFFSET * (generation - 1) + PASTE_CURSOR_NUDGE,
        };
      }

      const pageRect = placementApiRef.current?.getPageClientRect();
      const sourceVisuals = clipboard.sourceVisuals ?? {};
      const visualRelatives = clipboard.visualRelatives ?? {};

      if (pageRect && Object.keys(sourceVisuals).length) {
        const updates = computeAtomicPasteOffsets({
          sources,
          copies,
          sourceVisuals,
          visualRelatives,
          anchorPage: {
            x: anchorClient.x - pageRect.left,
            y: anchorClient.y - pageRect.top,
          },
        });
        copies.forEach((copy, i) => {
          stampPasteOffset(overlay, copy, sources[i], updates[i]);
        });
      } else {
        applyStackNudgeToCopies(sources, copies, generation);
        copies.forEach((copy, i) => {
          stampPasteOffset(overlay, copy, sources[i], {
            offsetX: copy.offsetX,
            offsetY: copy.offsetY,
          });
        });
      }

      commitCopies(treeTarget.parentId, treeTarget.afterId ?? afterId);
    },

    [selectedId, selectedIds, history, endContinuousEdit, bumpStackGeneration, overlayMode]

  );



  const handleDuplicate = useCallback(

    (elementId) => {

      const ids = mutableIds(
        configRef.current?.elements ?? [],
        elementId
          ? [elementId]
          : selectedIds.length
            ? selectedIds
            : selectedId
              ? [selectedId]
              : []
      );

      if (!ids.length || !configRef.current) return;

      const sources = collectElementsByIds(configRef.current.elements, ids);
      if (!sources.length) return;

      const copies = sources.map((source) => cloneForPaste(source));
      const overlay = getOverlay(overlayMode);
      const generation = bumpStackGeneration(ids);
      applyStackNudgeToCopies(sources, copies, generation);
      copies.forEach((copy, i) => {
        stampPasteOffset(overlay, copy, sources[i], {
          offsetX: copy.offsetX,
          offsetY: copy.offsetY,
        });
      });

      const lastId = ids[ids.length - 1];
      const parentId = findParentId(configRef.current.elements, lastId);

      endContinuousEdit();

      setConfig((prev) => {
        history.push(prev);
        let elements = insertIntoTreeMany(prev.elements, copies, {
          parentId,
          afterId: lastId,
        });
        for (const copy of copies) {
          elements = setZOrderExtreme(elements, copy.id, "front");
        }
        return { ...prev, elements };
      });

      setSelectedIds(copies.map((copy) => copy.id));
      setPageSelected(false);
    },

    [selectedId, selectedIds, history, endContinuousEdit, bumpStackGeneration, overlayMode]

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

      const ids = mutableIds(
        configRef.current?.elements ?? [],
        resolveTargetIds(elementId, selectedIds, selectedId)
      );

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

      const movable = mutableIds(configRef.current.elements, ids);
      if (!movable.length) return;

      const overlay = getOverlay(overlayMode);
      endContinuousEdit();

      setConfig((prev) => {
        const nudged = nudgeElements(prev.elements, movable, dx * step, dy * step, {
          snapEnabled,
          gridSnapEnabled,
        });
        const updates = movable.flatMap((id) => {
          const before = findElementById(prev.elements, id);
          const after = findElementById(nudged, id);
          if (!before || !after) return [];
          const patch = overlay.patchOffset(mergeElement(before), {
            offsetX: after.offsetX,
            offsetY: after.offsetY,
          });
          return patch ? [{ id, ...patch }] : [];
        });
        if (!updates.length) return prev;
        history.push(prev);
        return {
          ...prev,
          elements: updateElementsInTree(prev.elements, updates),
        };
      });
    },
    [selectedIds, history, endContinuousEdit, snapEnabled, gridSnapEnabled, overlayMode]
  );



  const handleGroup = useCallback(() => {
    if (!configRef.current) return;
    const prev = configRef.current;
    const { elements: next, containerId } = groupMutableSelection(prev.elements, selectedIds);
    if (!containerId) return;
    endContinuousEdit();
    history.push(prev);
    setConfig({ ...prev, elements: next });
    setSelectedIds([containerId]);
  }, [selectedIds, history, endContinuousEdit]);

  const handleUngroup = useCallback(() => {
    if (!configRef.current) return;
    const { elements: next, childIds } = ungroupMutableSelection(
      configRef.current.elements,
      selectedIds
    );
    if (next === configRef.current.elements) return;
    endContinuousEdit();
    const prev = configRef.current;
    history.push(prev);
    setConfig({ ...prev, elements: next });
    setSelectedIds(childIds.length ? childIds : []);
  }, [selectedIds, history, endContinuousEdit]);

  const handleAlignChildren = useCallback(
    (containerId, horizontal, vertical) => {
      if (!canMutate(configRef.current?.elements ?? [], containerId)) return;
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
      const mutable = mutableIds(configRef.current.elements, ids);
      if (!mutable.length) return;
      endContinuousEdit();
      setConfig((prev) => {
        history.push(prev);
        return {
          ...prev,
          elements: alignMutableSelection(prev.elements, ids, { horizontal, vertical }),
        };
      });
    },
    [selectedIds, selectedId, history, endContinuousEdit]
  );

  const handleDistribute = useCallback(
    (axis) => {
      const ids = selectedIds.length ? selectedIds : [];
      if (ids.length < 3 || !configRef.current) return;
      const mutable = mutableIds(configRef.current.elements, ids);
      if (mutable.length < 3) return;
      endContinuousEdit();
      setConfig((prev) => {
        history.push(prev);
        return {
          ...prev,
          elements: distributeMutableSelection(prev.elements, ids, axis),
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

        const movable = mutableIds(configRef.current?.elements ?? [], selectedIds);

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
  const inspectorSelected =
    selected && gestureDraft && !Array.isArray(gestureDraft) && gestureDraft.id === selected.id
      ? { ...selected, ...gestureDraft }
      : selected;

  const selectionCount = selectedIds.length;

  const canRevert =

    sessionBaseline !== null && !configsEqual(config, sessionBaseline);

  const canGroupSelection =
    mutableIds(config.elements, selectedIds).length >= 2;
  const canUngroupSelection =
    selectedIds.length === 1 &&
    selected?.type === "container" &&
    canMutate(config.elements, selected.id);



  return (

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

      selected={inspectorSelected}

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

      toast={toast}

      overlayMode={overlayMode}

      onOverlayMode={handleOverlayMode}

    >

      <PageRenderer

        config={config}

        pagePreset={pagePreset}

        overlayMode={overlayMode}

        onGestureDraft={setGestureDraft}

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

      />

    </EditorShell>

  );

}

