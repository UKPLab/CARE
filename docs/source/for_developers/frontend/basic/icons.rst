Icons
-----

The icon components provide a unified way to include SVG icons across the frontend.  
They handle loading, colors, and fallbacks, so you can use them consistently in buttons, forms, and dashboards.  

There are three main classes:

**IconAsset** – Displays static SVGs from the ``/icons`` folder, e.g. the CARE logo.  
Use this when you want to render application-specific assets that are not part of Bootstrap Icons.  

**IconBootstrap** – Loads icons from the bundled Bootstrap icon set.  
This is the low-level building block behind *BasicIcon* and can be used directly if you need tight control.  

**IconLoading** – Renders a simple spinner animation.  
Useful to indicate waiting states, either directly or via *BasicIcon* with ``iconName="loading"``.  

Example for rendering the CARE logo with **IconAsset**:

.. code-block:: html

    <IconAsset
        name="logo"
        :height="200"
    />

.. code-block:: javascript

    import IconAsset from "@/basic/icons/IconAsset.vue";

    export default {
      components: { IconAsset }
    }

-----

**Usage hints:**

- Use **BasicIcon** for most cases; it dynamically wraps *IconBootstrap* and shows a loader until the SVG is ready.  
- Use **IconAsset** for application logos or other custom icons in ``/icons``.  
- Use **IconLoading** whenever you need a spinner (or pass ``loading`` as the `iconName` to *BasicIcon*).  

All icon components support optional `size`, `color`, and accessibility-friendly defaults.
