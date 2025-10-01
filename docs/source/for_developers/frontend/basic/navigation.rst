Navigation
----------

The navigation components provide a consistent, app-wide top bar, an overflow menu, and composable buttons.  
They expose **placeholders** that can be targeted with Vue’s ``<Teleport>`` to inject actions from any view.

There are three main classes:

**TopBar** – The fixed application navbar (logo, back/home, project switcher, user menu).  
It renders placeholder anchors that can be filled from anywhere:

- ``#topbarCustomPlaceholder`` – left/primary action area  
- ``#topbarCenterPlaceholder`` – centered content (e.g., titles)  
- ``#topBarNavItems`` – right-aligned nav items  
- ``#topBarExtendMenuItems`` – items for the overflow menu (see **ExpandMenu**)  

It also includes an optional **Project** picker (controlled by the setting ``topBar.projects.hideProjectButton``)  
and a profile dropdown (consent, password change, logout).

**ExpandMenu** – A dropdown menu component (three-dot icon) anchored in the top bar.  
Use it for secondary actions injected via ``#topBarExtendMenuItems``.

**TopBarButton** – A reusable button element for the top bar.  
Supports icons, emits click events, and integrates with statistics logging automatically.

Example usage with ``Teleport``:

.. code-block:: html

    <Teleport to="#topbarCustomPlaceholder">
      <TopBarButton
        class="btn btn-outline-primary me-3"
        title="Previous"
        @click="updateStep(currentStudyStep.studyStepPrevious)"
      >
        Previous
      </TopBarButton>

      <TopBarButton
        class="btn btn-outline-secondary mx-3"
        title="Finish Study"
        @click="finish"
      >
        Finish Study
      </TopBarButton>

      <TopBarButton
        class="btn btn-outline-primary ms-3"
        title="Next"
        @click="updateStep(nextStudyStep.id)"
      >
        Next
      </TopBarButton>
    </Teleport>

-----

**Usage hints:**

- Use **TopBar** for global navigation and session-related controls.  
- Add items to **ExpandMenu** for rarely used or secondary actions.  
- Prefer **TopBarButton** for clear, consistent action buttons in the top bar.  
