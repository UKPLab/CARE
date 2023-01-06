Icons
=====

`Bootstrap icons <https://icons.getbootstrap.com/>`_ are available for all icons.

The icons are included as SVGs through the LoadIcon.vue component.

.. code-block:: html

    <template>
        <LoadIcon iconName="<bootstrap_icon_name>" size="<size in px>"/>
    </template>

.. code-block:: javascript

        import LoadIcon from '@/components/LoadIcon.vue'

        export default {
            components: {
                LoadIcon
            }
        }

.. note::

    The size is optional and defaults to 16px.


.. tip::

    Use 'loading' as the icon name to show a loading spinner.

The list of icons can also be found in /node_modules/bootstrap-icons/icons.
