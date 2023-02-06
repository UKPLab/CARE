vuex Store
==========

The vuex store is the central memory accessible across all components of the frontend application. Additionally, the
store is responsible for managing data updates coming from the backend socket interface. Most of your use cases should
be covered by the existing store, but in case you add new socket messages you have to extend it.

Store Structure
---------------
The store is structured into modules, which are all defined in ``frontend/src/store/modules``. Each defines a default
state used upon initialization, provides getters, mutations and actions. To access data from vue components, you will
use the getters of the respective module providing your read-only access. In the mutations the store may listen to
socket messages and update the internal state accordingly.

All changes to the store are forwarded to the components that use the respective getters. Store modules cannot access
the state of other store modules. You may add several different getter functions providing different views on the same
data. The vuex store is not persistent; i.e. reloading the webpage in the browser discards the store and forces
reloading of the data from the backend.

.. note::
    Checkout the vuex store documentation here: `https://vuex.vuejs.org/guide/`_.


Accessing the Store
-------------------
To access the store, you can simply use the following line of code within your component:

.. code-block:: javascript

    this.$store.getters["anno/getAnnotations"]("X")

Here the getter ``getAnnotations`` of the ``anno`` store module is loaded passing the parameter "X". The resulting
list can be further processed according to the needs of the respective component.


Adding a Store Module
---------------------

If you want to add a new module "test" to the vuex store, you add a new file ``test.js`` to ``frontend/src/store/modules``,
which exports the store hooks.

.. code-block:: javascript

    const getDefaultState = () => {
        return {
            test: []
        };
    };

    export default {
        namespaced: true,
        strict: true,
        state: getDefaultState(),
        getters: {},
        mutations: {},
        actions: {}
    };

In addition, you need to update the store ``index.js`` to import the new module and add it to the module list.

.. code-block:: javascript

    import TestStore from "./modules/test.js";


    export default createStore({
        modules: {
            //...
            test: TestStore,
        },
        /*...*/
    });

Extending a Store Module
------------------------
If you simply want to extend an existing store module by a getter function, add it to the getters attribute.
A getter is always a function mapping the ``state`` to a result, where the state is the module's store state. The
state is first initialized by the default state and then updated through mutations.

.. code-block:: javascript

    getTest: state => {
            return state["test"]
    }

To add a new socket listener, simply add a new method to the ``mutations`` with the prefix ``SOCKET_``. This method
receives again the store state and the actual socket data received on the respective message type:

.. code-block:: javascript

    SOCKET_refreshTest (state, message) => {
        state['test'].push(message.test);
    }

This code snippet listens on the "refreshTest" event of the socket and pushes the message's test attribute into the
store.
