Working with the Moodle API
===========================

If you want to work with the Moodle API, please take a look at this document to get an overview of the API integration and how to use it.

General structure
-----------------

All Moodle API calls are made via an rpc call and therefore run on a dedicated docker container.
The main.py file in the moodleAPI folder `./utils/rpcs/moodleAPI` is responsible for the execution of the Moodle API commands.
The result is then returned to the socket and can be used in the backend.

.. note::

    Take a look at the `rpc.rst <docs/source/for_developers/backend/rpc.rst>`_ to get an overview on how the rpc calls work in general.

Usage
-----

The following functions can by called from the backend:

**getUsersFromCourse**: This method retrieves all users from a given course. It then creates a CSV file containing user information: ID, username, firstname, lastname, email, and their roles in the course (e.g. student/tutor).
parameters: {courseID: int, options{url: string, apiKey: string}}

.. code-block:: javascript

    try {
        data = {courseID: 1, options: {...}}
        const response = await this.server.rpcs["MoodleRPC"].getUsersFromCourse(data);
    } catch (error) {
        // handle error
    }

**getUsersFromAssignment**: This method retrieves all users from a given assignment. It then creates a CSV file containing user information: ID, username, firstname, lastname, email, and their roles in the course (e.g. student/tutor).
parameters: {courseID: int, assignmentID: int, options{url: string, apiKey: string}}

.. code-block:: javascript

    try {
        data = {courseID: 1, assignmentID: 1, options: {...}}
        const response = await this.server.rpcs["MoodleRPC"].getUsersFromAssignment(data);
    } catch (error) {
        // handle error
    }

**getSubmissionsInfosFromAssignment**: This method retrieves all submissions from a given assignment. It then returns a list of dictionaries containing the user IDs and their corresponding submission file names and urls. This method should be used in preperation for downloading the submissions.
parameters: {courseID: int, assignmentID: int, options{url: string, apiKey: string}}

.. code-block:: javascript

    try {
        data = {courseID: 1, assignmentID: 1, options: {...}}
        const response = await this.server.rpcs["MoodleRPC"].getSubmissionsInfosFromAssignment(data);
    } catch (error) {
        // handle error
    }

**downloadSubmissionsFromUser**: This method downloads all submissions from the provided urls. It then returns a list of the files in binary format. The urls for the files can be obtained by calling the getSubmissionsInfosFromAssignment method.
parameters: submission_infos: list with urls: string

.. code-block:: javascript

    try {
        data = {submission_infos: ["url1", "url2", ...]}
        const response = await this.server.rpcs["MoodleRPC"].downloadSubmissionsFromUser(data);
    } catch (error) {
        // handle error
    }

**uploadPasswordsToMoodle**: This method can be used to upload passwords as feedback in an assignment to Moodle.
parameters: {courseID: int, assignmentID: int, passwords: list: {id: int, password: string}, options{url: string, apiKey: string}}

.. code-block:: javascript

    try {
        data = {courseID: 1, assignmentID: 1, passwords: [{id: 1, password: "password1"}, {id: 2, password: "password2"}], options: {...}}
        const response = await this.server.rpcs["MoodleRPC"].uploadPasswordsToMoodle(data);
    } catch (error) {
        // handle error
    }

Configure Moodle
----------------

Administrator configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~

If your Moodle Service is not yet configured to use the API, please follow the steps:

* The administrator of the Moodle service needs to enable access to the API (web services). Each user who wants to use the API needs to have a token.

  Instructions on how to do this can be found in the 
  `Moodle documentation: <https://docs.moodle.org/404/en/Using_web_services>`_

  \nKeep in mind that every api function needs to be activated separately. The function you need to enable in moodle are:

  1. **core_enrol_get_enrolled_users**
  2. **mod_assign_save_grade**
  3. **mod_assign_get_assignments**
  4. **mod_assign_get_user_mappings**
  5. **mod_assign_get_submissions**

* To use any functionality that includes downloading submissions files, the administrator needs to enable "Can Download File" in the Active External Web Service. This includes the following steps:

  1. **Navigate to Moodle Site Admin**

     Log in to your Moodle site as an administrator and go to the "Site Administration" page.

  2. **Search for External Services**
  
     On the "Site Administration" page, use the search bar to look for "External Services." Click on it to access the External Services section.

  3. **Edit Active External Services**
  
     In the External Services section, find the active external service used for syncing course images. Click the "Edit" button next to it.

  4. **Expand the Page**
  
     Once on the Active External Service page, expand the options by clicking the "Show more" button at the bottom of the page.

  5. **Enable "Can Download Files" Setting**
  
     Check the box next to "Can download files" to enable this setting.

  6. **Save Changes**
  
     After enabling the "Can download files" option, click on the "Save changes" button at the bottom of the page to apply your updates.

  The information was taken from this `website  <https://edwiser.helpscoutdocs.com/article/559-how-to-enable-can-download-file-in-the-active-external-web-service>`_. You can also find a visual guide there.

If you want to add new functionality to the Moodle API, these links might be helpful:

1. `Moodle API Documentation <https://docs.moodle.org/310/en/Web_services_API>`_: This site provides an overview of the Moodle API and its functions. If you are looking for a specific topic, e.g. 'submission', you can use this keyword to search for the specific function you need. However this site only contains the name of the functions and a short description. For more detailed information, you can use the following link.
2. `Moodle Github Repository <https://github.com/moodle/moodle>`_: This link leads you to the Moodle GitHub repository. Here you can find the source code of the Moodle API. If you are looking for a specific function, you can use the search bar to find the function you need. This is helpful if you want to know how the function works and what parameters it needs. Usually the relevant function is located in the 'exterballib.php' file of the module. Next to the function you can find another function with the same name but with the suffix 'parameters'. This function contains the parameters you need to call the function. To get an idea on how to pass the parameters in the correct format in pyton format, take a look at the existing functions.

.. note::

    You need an **API key** and the **API url** to access the Moodle API. The API key can be generated in the Moodle settings for a specific user.
    The API key is used to authenticate the user and to ensure that the user has the necessary permissions to access the API.
    The API url is usually the standard moodle url.


Course configuration
~~~~~~~~~~~~~~~~~~~~

To get the course ID from a moodle course, just navigate to the homepage of the course and you will see 'id=xxxx' in the URL.
The number after the 'id=' is the course ID.

To get the assignment ID from a moodle assignment,
just navigate to the assignment and you will see 'id=xxxx' in the URL.
The number after the 'id=' is the assignment ID.


Implementing new functionality
------------------------------

Keep attention to the following steps to implement new functionality in the Moodle API:

Rebuild the docker container
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If the `main.py` file is modified, the docker container needs to be rebuilt.
This can be done by running the following command:

1. Delete the moodle container in docker

.. code-block:: bash

    docker compose -f docker-compose.yml build rpc_moodle
.. code-block:: bash

    docker compose -f docker-compose.yml run rpc_moodle
.. code-block:: bash

    make docker

After the 'make docker' command, you should see 'moodle...container recreated' in the console.


