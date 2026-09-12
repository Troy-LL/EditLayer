import { useCallback } from "react";
import {
  alignChildrenInContainer,
  alignMutableSelection,
  canMutate,
  distributeMutableSelection,
  findElementById,
  groupMutableSelection,
  mutableIds,
  selectionAfterToggleLock,
  ungroupMutableSelection,
  updateElementInTree,
} from "./elementTree.js";
import { mergeElement } from "./elementDefaults.js";

export default function useEditorMutations({
  configRef,
  selectedIds,
  selectedId,
  setSelectedIds,
  setConfig,
  history,
  endContinuousEdit,
}) {
  const handleGroup = useCallback(() => {
    if (!configRef.current) return;
    const prev = configRef.current;
    const { elements: next, containerId } = groupMutableSelection(prev.elements, selectedIds);
    if (!containerId) return;
    endContinuousEdit();
    history.push(prev);
    setConfig({ ...prev, elements: next });
    setSelectedIds([containerId]);
  }, [configRef, selectedIds, history, endContinuousEdit, setConfig, setSelectedIds]);

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
  }, [configRef, selectedIds, history, endContinuousEdit, setConfig, setSelectedIds]);

  const handleAlignChildren = useCallback(
    (containerId, horizontal, vertical) => {
      if (!canMutate(configRef.current?.elements ?? [], containerId)) return;
      endContinuousEdit();
      setConfig((prev) => {
        history.push(prev);
        const target = findElementById(prev.elements, containerId);
        if (!target) return prev;
        const aligned = alignChildrenInContainer(target, horizontal, vertical, prev.elements);
        return {
          ...prev,
          elements: updateElementInTree(prev.elements, containerId, {
            children: aligned.children,
          }),
        };
      });
    },
    [configRef, history, endContinuousEdit, setConfig]
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
    [configRef, selectedIds, selectedId, history, endContinuousEdit, setConfig]
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
    [configRef, selectedIds, history, endContinuousEdit, setConfig]
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
    [configRef, history, endContinuousEdit, setConfig, setSelectedIds]
  );

  const handleToggleHidden = useCallback(
    (id) => {
      if (!canMutate(configRef.current?.elements ?? [], id)) return;
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
    [configRef, history, endContinuousEdit, setConfig, setSelectedIds]
  );

  const handleRenameLayer = useCallback(
    (id, name) => {
      if (!canMutate(configRef.current?.elements ?? [], id)) return;
      endContinuousEdit();
      setConfig((prev) => {
        history.push(prev);
        return {
          ...prev,
          elements: updateElementInTree(prev.elements, id, { name }),
        };
      });
    },
    [configRef, history, endContinuousEdit, setConfig]
  );

  return {
    handleGroup,
    handleUngroup,
    handleAlignChildren,
    handleAlign,
    handleDistribute,
    handleToggleLock,
    handleToggleHidden,
    handleRenameLayer,
  };
}
