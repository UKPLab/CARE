/**
 * Look-back helpers for Study.vue: the earlier steps a step can look back at,
 * and the sidebar tabs that show them read-only
 *
 * @author Ilyas Mohammed
 */

/**
 * Names each step as its workflow step is called; names that occur more than once get the step number
 * @param {Array<Object>} steps - study steps in workflow order
 * @param {Function} getWorkflowStep - returns the workflow step with the given id
 * @param {Function} fallback - returns the name for a step number when the workflow step has none
 * @returns {Object} step id mapped to its label
 */
export function buildStepLabels(steps, getWorkflowStep, fallback) {
  const names = steps.map((step, index) => getWorkflowStep(step.workflowStepId)?.name || fallback(index + 1));
  return Object.fromEntries(steps.map((step, index) => {
    const isDuplicate = names.filter((name) => name === names[index]).length > 1;
    return [step.id, isDuplicate ? `${names[index]} ${index + 1}` : names[index]];
  }));
}

/**
 * Finds the earlier steps that "Previous" could reach from a step, in workflow order.
 * Only Annotator (1) and Editor (2) steps, because those can be forced read-only.
 * @param {Object} step - the step to look back from
 * @param {Function} getStep - returns the study step with the given id
 * @param {Function} isLoaded - whether the step with the given id is loaded
 * @returns {Array<Object>} the earlier steps
 */
export function findEarlierSteps(step, getStep, isLoaded) {
  const steps = [];
  let current = step;
  while (current && current.allowBackward && current.studyStepPrevious) {
    current = getStep(current.studyStepPrevious);
    if (current && [1, 2].includes(current.stepType) && isLoaded(current.id)) {
      steps.unshift(current);
    }
  }
  return steps;
}

/**
 * Builds the sidebar tabs that show earlier steps read-only: the annotations of Annotator steps (stepType 1)
 * and the assessment of steps that have one. Their slot names are numbers on purpose: JavaScript lists
 * numeric object keys first and in ascending order, so these tabs come before a step's own tabs, in workflow order.
 * @param {Array<Object>} earlierSteps - the earlier steps, from findEarlierSteps
 * @param {Array<Object>} steps - all study steps in workflow order
 * @param {Object} labels - step id mapped to its label, from buildStepLabels
 * @param {Function} $t - Vue i18n translate function
 * @returns {Array<Object>} tabs with key (slot name), type, icon, step, number and title
 */
export function buildLookBackTabs(earlierSteps, steps, labels, $t) {
  const tabs = [];
  earlierSteps.forEach((earlier) => {
    const number = steps.findIndex((s) => s.id === earlier.id) + 1;
    // A tab is named like its step; only a step with two tabs also says what each one shows
    const label = labels[earlier.id];
    const hasAssessment = !!earlier.configuration?.settings?.configurationId;
    const hasBoth = earlier.stepType === 1 && hasAssessment;
    if (earlier.stepType === 1) {
      const title = hasBoth ? $t('components.studyRoute.panes.annotationsOfStep', {step: label}) : label;
      tabs.push({key: String(number * 10), type: "annotations", icon: "pencil-square", step: earlier, number, title});
    }
    if (hasAssessment) {
      const title = hasBoth ? $t('components.studyRoute.panes.assessmentOfStep', {step: label}) : label;
      tabs.push({key: String(number * 10 + 1), type: "assessment", icon: "list-check", step: earlier, number, title});
    }
  });
  return tabs;
}

/**
 * Builds the look-back sidebar tabs of every step. Kept apart from buildLookBack, so the tabs are not rebuilt
 * when only the step on screen or the split changes, and each pane keeps the same list
 * @param {Object} state - the study state
 * @param {Array<Object>} state.steps - study steps in workflow order
 * @param {Object} state.labels - step id mapped to its label, from buildStepLabels
 * @param {Function} state.getStep - returns the study step with the given id
 * @param {Function} state.isLoaded - whether the step with the given id is loaded
 * @param {Function} state.$t - Vue i18n translate function
 * @returns {Object} step id mapped to its tabs, from buildLookBackTabs
 */
export function buildTabsByStep({steps, labels, getStep, isLoaded, $t}) {
  return Object.fromEntries(steps.map((step) =>
      [step.id, buildLookBackTabs(findEarlierSteps(step, getStep, isLoaded), steps, labels, $t)]));
}

/**
 * Whether a sidebar tab of a pane is shown: a look-back tab while its step is on screen,
 * the pane's own tabs unless the pane is hidden
 * @param {string} slotName - the tab's slot name
 * @param {Array<Object>} lookBackTabs - the pane's look-back tabs, from buildTabsByStep
 * @param {number|null} shownLookBackStepId - the earlier step on screen, if the pane has a tab for it
 * @param {boolean} ownTabsHidden - whether the pane's own tabs are hidden
 * @returns {boolean} whether the tab is shown
 */
export function isLookBackTabShown(slotName, lookBackTabs, shownLookBackStepId, ownTabsHidden) {
  const lookBackTab = lookBackTabs.find((tab) => tab.key === slotName);
  return lookBackTab ? lookBackTab.step.id === shownLookBackStepId : !ownTabsHidden;
}

/**
 * Whether a sidebar tab belongs to the step itself, in a step that also has look-back tabs
 * @param {string} slotName - the tab's slot name
 * @param {Array<Object>} lookBackTabs - the pane's look-back tabs, from buildTabsByStep
 * @returns {boolean} whether the tab is one of the step's own tabs
 */
export function isCurrentStepTab(slotName, lookBackTabs) {
  return lookBackTabs.length > 0 && !lookBackTabs.some((tab) => tab.key === slotName);
}

/**
 * Everything Study.vue needs to show earlier steps next to or instead of the current one.
 * An earlier step takes the place of the current one while it is selected in the workflow bar. The current step
 * stays shown as well: next to it in a split, otherwise hidden except its sidebar (see PaneStrip.vue).
 * Each step's sidebar opens on the tab of the step on screen, else on its own tab (the assessment of an Editor
 * step that has one), and shows only the tabs of the steps on screen.
 * @param {Object} state - the study state
 * @param {Array<Object>} state.steps - study steps in workflow order
 * @param {Object} state.currentStep - the step the student is on
 * @param {number|null} state.shownStepId - the step selected in the workflow bar
 * @param {string|null} state.splitLayout - the split layout, null when not split
 * @param {Object} state.tabsByStep - step id mapped to its look-back tabs, from buildTabsByStep
 * @param {Function} state.getStep - returns the study step with the given id
 * @param {Function} state.isLoaded - whether the step with the given id is loaded
 * @returns {Object} earlierSteps, hiddenStepId, dataSplit, isVisible(stepId) and paneProps
 *     (the props of each step's Annotator or Editor; only plain values, so a pane re-renders only when its own change)
 */
export function buildLookBack({steps, currentStep, shownStepId, splitLayout, tabsByStep, getStep, isLoaded}) {
  const earlierSteps = findEarlierSteps(currentStep, getStep, isLoaded);
  const shownEarlier = earlierSteps.some((step) => step.id === shownStepId);
  const currentStepId = currentStep?.id ?? null;
  const hiddenStepId = shownEarlier && !splitLayout ? currentStepId : null;
  const isVisible = (stepId) => stepId === currentStepId || (shownEarlier && stepId === shownStepId);
  const paneProps = Object.fromEntries(steps.map((step) => {
    const tabs = tabsByStep[step.id];
    const shownTab = tabs.find((tab) => tab.step.id === shownStepId);
    const ownTab = step.stepType === 2 && step.configuration?.settings?.configurationId ? "additionalSidebars" : null;
    return [step.id, {
      activeSidebar: shownTab ? shownTab.key : ownTab,
      lookBackTabs: tabs,
      shownLookBackStepId: shownTab ? shownStepId : null,
      ownTabsHidden: hiddenStepId === step.id,
      forceReadOnly: step.id !== currentStepId,
      sidebarDisabled: step.id !== currentStepId,
      isShown: isVisible(step.id),
    }];
  }));
  return {earlierSteps, hiddenStepId, dataSplit: splitLayout || (hiddenStepId !== null ? "single" : null), isVisible, paneProps};
}
