/**
 * Manages the sidebar's floating hover preview, including its visibility
 * and positioning based on mouse events and DOM geometry.
 * Exports state, computed properties, and methods for use in Sidebar.vue.
 * Reads `this.groupStates` to avoid previewing already-expanded groups.
 *
 * @author Carly Gettinger, Dennis Zyska, Nils Dycke, Andrii Nikitin
 */

// Fresh data factory so preview state is never shared across component instances
export function sidebarHoverPreviewData() {
  return {
    hoveredGroup: null,
    previewStyle: {},
    isHoveringPreview: false,
    previewAnchor: null,
    previewResizeObserver: null,
  };
}

export function getSidebarPreviewStyle(anchorRect, previewRect, viewport, margin = 8) {
  const safeMargin = Math.min(margin, viewport.width / 2, viewport.height / 2);
  const maxWidth = Math.max(0, viewport.width - safeMargin * 2);
  const maxHeight = Math.max(0, viewport.height - safeMargin * 2);
  const width = Math.min(previewRect.width, maxWidth);
  const height = Math.min(previewRect.height, maxHeight);
  const maxLeft = Math.max(safeMargin, viewport.width - safeMargin - width);
  const maxTop = Math.max(safeMargin, viewport.height - safeMargin - height);
  const left = Math.max(safeMargin, Math.min(anchorRect.right, maxLeft));
  const top = Math.max(safeMargin, Math.min(anchorRect.top - margin, maxTop));

  return {
    left: `${left}px`,
    top: `${top}px`,
    maxWidth: `${maxWidth}px`,
    maxHeight: `${maxHeight}px`,
  };
}

export const sidebarHoverPreviewComputed = {
  // Resolves the currently-hovered group's full data for the single shared <SidebarPreview>
  hoveredSubgroup() {
    return this.defaultGroupedElements.find(group => group.key === this.hoveredGroup) || null;
  },
};

export const sidebarHoverPreviewMethods = {
  resetPreview() {
    this.hoveredGroup = null;
    this.previewStyle = {};
    this.isHoveringPreview = false;
    this.previewAnchor = null;
    this.previewResizeObserver?.disconnect();
    this.previewResizeObserver = null;
  },

  // Checks whether the mouse moved into a related element of the same subgroup
  // Used to prevent flickering when moving the cursor from subgroup header
  // to preview and back
  _isRelatedTargetInGroup(event, groupName, selector) {
    const relatedTarget = event.relatedTarget;
    if (typeof relatedTarget?.closest !== "function") {
      return false;
    }

    return relatedTarget.closest(selector)?.dataset?.groupKey === groupName;
  },

  handleGroupMouseEnter(event, groupName) {
    if (this.groupStates[groupName]) {
      this.resetPreview();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    this.previewAnchor = event.currentTarget;

    this.previewStyle = {
      top: `${rect.top - 8}px`,
      left: `${rect.right}px`,
      maxWidth: `${Math.max(0, window.innerWidth - 16)}px`,
      maxHeight: `${Math.max(0, window.innerHeight - 16)}px`,
    };
    this.hoveredGroup = groupName;
    this.$nextTick(() => {
      this.observePreviewPosition();
      this.updatePreviewPosition();
    });
  },

  observePreviewPosition() {
    const preview = this.$refs.sidebarPreview?.$el;
    if (!this.previewAnchor?.isConnected || !preview || typeof ResizeObserver === "undefined") {
      return;
    }

    if (!this.previewResizeObserver) {
      this.previewResizeObserver = new ResizeObserver(() => this.updatePreviewPosition());
    }

    this.previewResizeObserver.disconnect();
    this.previewResizeObserver.observe(this.previewAnchor);
    this.previewResizeObserver.observe(preview);
  },

  updatePreviewPosition() {
    const preview = this.$refs.sidebarPreview?.$el;
    if (!this.hoveredGroup || !this.previewAnchor?.isConnected || !preview) {
      return;
    }

    this.previewStyle = getSidebarPreviewStyle(
      this.previewAnchor.getBoundingClientRect(),
      preview.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight }
    );
  },

  handleGroupMouseLeave(event, groupName) {
    if (this._isRelatedTargetInGroup(event, groupName, '.submenu-preview')) return;
    this.resetPreview();
  },

  handlePreviewMouseEnter() {
    this.isHoveringPreview = true;
  },

  handlePreviewMouseLeave(event, groupName) {
    this.isHoveringPreview = false;

    if (this._isRelatedTargetInGroup(event, groupName, '.sidebar-subgroup-heading')) return;

    this.resetPreview();
  },
};
