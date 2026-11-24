import { prefersLessMotion } from "@/assets/performanceMonitor.js";
/**
 * Navigation between the signed-out pages (login <-> register) with a View Transition.
 *
 * Both pages render the same AuthLayout, so the page frame stays still. AuthLayout names
 * three parts of the card: the frame (background, border, shadow), the header and the
 * body. The frame morphs to the new size, the content slides in the direction of
 * travel. Animations are defined in AuthLayout.vue.
 *
 * Browsers without the View Transitions API, or users who prefer reduced motion,
 * get a plain router navigation.
 */
import { nextTick } from "vue";

/**
 * Load the lazy route components of the target before the transition starts.
 * The page is frozen while the transition waits for the DOM update, so the chunk
 * download must not happen inside it.
 */
async function preloadRouteComponents(router, location) {
  const target = router.resolve(location);
  await Promise.all(
    target.matched.flatMap((record) =>
      Object.values(record.components || {}).map((component) =>
        typeof component === "function" ? component() : null
      )
    )
  );
}

/**
 * @param {import('vue-router').Router} router
 * @param {import('vue-router').RouteLocationRaw} location
 * @param {"forward"|"back"} [direction="forward"] - "forward" slides the content to the left, "back" to the right
 * @returns {Promise<void>}
 */
export async function navigateWithAuthTransition(router, location, direction = "forward") {
  // Reduced motion or a weak machine (performanceMonitor.js): a view transition snapshots and
  // animates the whole page, which stutters there; switch pages directly.
  if (typeof document.startViewTransition !== "function" || prefersLessMotion()) {
    await router.push(location);
    return;
  }

  try {
    await preloadRouteComponents(router, location);
  } catch (_error) {
    // The router reports loading errors itself on push.
  }

  const root = document.documentElement;
  root.dataset.authDirection = direction;

  const transition = document.startViewTransition(async () => {
    await router.push(location);
    await nextTick();
  });
  transition.finished.finally(() => {
    delete root.dataset.authDirection;
  });
  await transition.updateCallbackDone;
}
