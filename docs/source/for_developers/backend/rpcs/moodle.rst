Moodle API
==========

If you want to work with the Moodle API, please take a look at this document to get an overview of the API integration and how to use it.

.. note::

   For guidance on using the Moodle API through the CARE platform (e.g., to import documents, manage assignments, or publish feedback), refer to the :doc:`Moodle API usage guide <../../../for_researchers/moodle_usage>`.

General structure
-----------------

All Moodle API calls are made via an rpc call and therefore run on a dedicated docker container.
The ``main.py`` file in the moodleAPI folder ``./utils/rpcs/moodleAPI`` is responsible for the execution of the Moodle API commands.
The result is then returned to the socket and can be used in the backend.

.. note::

    Take a look at the `rpc.rst <docs/source/for_developers/backend/rpc.rst>`_ to get an overview on how the rpc calls work in general.

Usage
-----

The following functions can by called from the backend:

**getUsersFromCourse**: This method retrieves all users from a given course. It then creates an array of dictionaries, containing user information: ID, username, firstname, lastname, email, and their roles in the course (e.g. student/tutor).
parameters: {courseID: int, options{url: string, apiKey: string}}

.. code-block:: javascript

    try {
        data = {courseID: 1, options: {...}}
        const response = await this.server.rpcs["MoodleRPC"].getUsersFromCourse(data);
    } catch (error) {
        // handle error
    }

**getUsersFromAssignment**: This method retrieves all users from a given assignment. It then creates an array of dictionaries, containing user information: ID, username, firstname, lastname, email, and their roles in the course (e.g. student/tutor).
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

**publishAssignmentTextFeedback**: This functions publishes the feedback text to the assignment per user.
parameters: {, feedback_data: list: {extId: int, text: string}, options{apiKey: string, apiUrl: string, courseID: int, assignmentID: int}}

User Import Integration
~~~~~~~~~~~~~~~~~~~~~~~

CARE supports importing user data from Moodle courses using the `getUsersFromCourse` RPC function. This function retrieves enrolled users from a given course and returns metadata including user IDs, roles, and email addresses.

The actual logic for user matching and account creation is handled by CARE’s backend service layer, not Moodle. This logic is important to be aware of when maintaining the integration.

CARE distinguishes Moodle-imported users based on email matching:

- **New users**: Created when the email from Moodle does not exist in CARE.
- **Duplicate users**: If the email already exists, the existing CARE account is updated with the Moodle `extId`.
- **Unverified users**: If the email is different but represents the same user (e.g., different domains), manual verification may be required.

The `extId` (external ID) is stored in CARE to represent the user's Moodle ID. It is required for feedback publishing and user association during review workflows.

.. warning::

   Deleting a CARE user with a stored `extId` may cause sync issues. Due to ID constraints, re-importing the same user may fail unless cleaned manually.

.. note::

   This RPC (`getUsersFromCourse`) provides raw data only. Matching, duplication checks, and user persistence happen entirely on the CARE backend and are not part of the Moodle RPC logic itself.

Configure Moodle
----------------

.. _moodle_admin_setup:

Administrator configuration
~~~~~~~~~~~~~~~~~~~~~~~~~~~

If your Moodle Service is not yet configured to use the API, please follow the steps:

* The administrator of the Moodle service needs to enable access to the API (web services). Each user who wants to use the API needs to have a token.

  Instructions on how to do this can be found in the 
  `Moodle documentation: <https://docs.moodle.org/404/en/Using_web_services>`_

  Keep in mind that every api function needs to be activated separately. The function you need to enable in moodle are:

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

.. _assignment_config_moodle:

Assignment creation
~~~~~~~~~~~~~~~~~~~~

Creating an assignment that is compatible with functionalities like downloading submissions or uploading login data as feedback, is really simple. Just follow these steps:

1. **Navigate to the right course in Moodle**

    Login to your Moodle account and click on 'My courses'.
    Click on the course you want to create the assignment in.
    If you can't see the course, you can use the search bar at the top.

2. **Activate the edit mode**

    Now you should be on the homepage of the course.
    Make sure that you have the right to edit the course.
    To find out, look at the upper right corner and check if you see 'Edit mode' and a switch next to it.

3. **Create an assignment**

    With 'edit mode' activated, navigate to the right section (e.g. 'General') where you want to create the assignment.
    Click on '+ Add an activity or resource' and add an 'Assignment' or 'Aufgabe' (if you are using the German version).

4. **Configure the assignment**

    Recommended settings for the feedback assignment are:

    - Name: Choose a name for the assignment.
    - Description: Write a description if needed.
    - Availability: Deactivate all options.
    - Submission types: Deactivate all options.
    - Feedback types: Activate 'Feedback comments' and set 'Inline comments' to 'Yes'.

**Submissions allowed**
If you want students to be able to make submission and download them afterwards, make sure that the 'Submission types' are set to 'File submissions' and the 'Feedback types' are set to 'Feedback comments'. If you want students to be able to submit multiple files, just increase 'Maximum number of uploaded files' under 'Submission types'. 
If you download the submissions of a student, all files will be retrieved.

Other settings can be adjusted as needed.

.. tip::

    You can change your role by clicking on your name in the upper right corner and then on 'Switch role to...'.


Findind the course and assignment IDs
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

For almost all functionalities, you need the course ID and the assignment ID. This is how you can find them:

**Course ID**
To get the course ID from a moodle course, just navigate to the homepage of the course and you will see 'id=xxxx' in the URL.
The number after the 'id=' is the course ID.

**Assignment ID**
To get the assignment ID from a moodle assignment,
just navigate to the assignment page and you will see 'id=xxxx' in the URL.
The number after the 'id=' is the assignment ID.

Implementing new functionality
------------------------------

Keep attention to the following steps to implement new functionality in the Moodle API:

Rebuild the docker container
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

If you modify ``main.py`` or any other Python file in the Moodle RPC module, the docker container needs to be rebuilt.
This can be done by running the following command:

1. Delete the moodle container in docker

.. code-block:: bash

    docker compose -f docker-compose.yml build rpc_moodle
.. code-block:: bash

    docker compose -f docker-compose.yml run rpc_moodle
.. code-block:: bash

    make docker

After the ``make docker`` command, you should see 'moodle...container recreated' in the console.


Extending the Moodle API Integration
------------------------------------

If you want to extend the Moodle API integration (e.g. by adding new endpoints or logic), follow these steps:

1. Edit or add functions in the RPC module, typically in ``main.py`` or ``Moodle.py``, both located in ``utils/rpcs/moodleAPI/``.
2. Follow the existing function structure using RPC-compatible patterns
3. If new API endpoints are added, ensure:
   - The corresponding Moodle functions are enabled in the external service
   - The service account has the required permissions
4. Add or update the frontend call in the corresponding service layer (if applicable)
5. Rebuild the Docker container (see previous section)
6. Update this documentation with any new or changed RPC methods

.. note::

   Do not hardcode course IDs, API keys, or URLs. These must be passed via configuration or backend RPC call parameters.