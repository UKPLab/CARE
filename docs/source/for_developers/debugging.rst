Debugging
=========

During development it is often necessary to get some insights into the different aspects of the application.
Thereby, a few methods have been found to be very helpful in accelerating the programming process.
Some of them are already describe inside the other sections of this documentation, but here they are listed again for convenience.

General
-------

Within the Development Mode (i.e. when running ``make dev``), we enabled different debugging options supporting you in the development process.
For example, the backend will log everything to the console, and the frontend will not minify the code. Also, the frontend will automatically reload the page when you change the code (i.e., hot loading).
Furthermore, the debugging options for vue.js are enabled, such that you can use the vue.js devtools to inspect the application.

.. tip::

    Use console.log() to print out the values of variables and objects.
    To help you find the output in the console, you can use some kind of prefix, e.g. ``console.log("debugging output: ", myVar);``.
    Remember that logging in backend is displayed in your terminal, while logging in frontend is displayed in your browser console (i.e., Developer tools).


Browser Developer Tools
-----------------------

Most of the commonly used browser support debugging tools, such as the developer console, the network tab, and the vue.js devtools.
The developer console is a very powerful tool, which allows you to inspect the DOM, the CSS, and the JavaScript code.
In the following, we will describe some of the most useful features of the developer console.

Inspect Websocket Connection
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

The websocket is used to communicate between the frontend and the backend. It is often necessary to inspect the websocket connection to see what data is sent and received between the frontend and the backend.
To do so, open the developer console and go to the network tab. Then, reload the page and at filter for ``websocket``.
The websocket connection should be listed there. Click on it to see the details.
On the ``Response`` tab, you can see the messages that are transmitted between the frontend and the backend.
Sometimes, it is necessary to reload the page again to see the messages.

Inspect Vue.js Components
~~~~~~~~~~~~~~~~~~~~~~~~~

The vue.js devtools are a very powerful tool to inspect the vue.js components.
If you have installed the vue.js devtools, you can open them by clicking on the ``Vue`` tab in the developer console.
There, you can see all the components that are currently loaded in the application, including the data and the computed properties of each component.

A very useful feature of the vue.js devtools is the ``Vuex`` module.
It allows you to inspect the state of the application, including the state of the different vuex modules.
Sometimes, it is necessary to reload the page again to see the vuex tab in the vue.js devtools.

Stopping open processes
-----------------------

Sometimes during development, the backend will throw an error, which is not handled by the application itself.
In that case, the backend will stop working but the process will not be terminated and a error message "Error: listen EADDRINUSE: address already in use :::3001" will be displayed in the terminal.
In such a case, you have to terminate the process manually in the system monitor.
To find the process, you can search for ``node`` in the system monitor.
If you are sure no other node process is running, you can also terminate the process by executing ``killall node`` in the terminal.


