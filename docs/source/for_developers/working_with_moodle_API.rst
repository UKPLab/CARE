Working with the Moodle API
================

If you want to work with the Moodle API, please take a look at this document to get an overview of the API integration and how to use it.

General structure
----------------------

All Moodle API calls are made via an rpc call and thereofore run on a different docker container. The main.py file in the moodleAPI folder is responsible for the actual call to the Moodle API. 
The result is then returned to the socket and can be used in the frontend or saved to the database. Take a look at the `rpc.rst <docs/source/for_developers/backend/rpc.rst>`_ to get an overview on how the rpc calls work and how to setup your own.

If you want to use the Moodle API from CARE, you need to follow a specific structure:

.. list-table:: Moodle API Integration
   :widths: 25 75
   :header-rows: 1

   * - Step
     - Description
   * - 1
     - Call from the frontend to the 'moodle socket' in the backend. You can also create your own socket by following the structure of the moodle socket.
   * - 2
     - From the socket a call to the 'moodle rpc' is made.
   * - 3
     - The 'moodle rpc' then makes a call to the main.py file, which is located in the 'moodleAPI' folder. 
   * - 4
     - In the main.py file, the actual call to the Moodle API is made.
   * - 5
     - The result is then returned to the socket.
   * - 6
     - Now you can use the result in the frontend or save it to the database.

If your Moodle Service is not yet configured to use the API, please follow the steps:

.. list-table:: Moodle API Extension
   :widths: 25 75
   :header-rows: 1

   * - Step
     - Description
   * - 1
     - The administrator of the Moodle service needs to enable access to the API (web services). Each user who wants to use the API needs to have a token. 
       Instructions on how to do this can be found in the Moodle documentation: ´https://docs.moodle.org/404/en/Using_web_services´
   * - 2
     - To use any functionality that includes downloading submissions files, the administrator needs to enable "Can Download File" in the Active External Web Service. This includes the following steps:
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

      A visual guide can be found  here: `https://edwiser.helpscoutdocs.com/article/559-how-to-enable-can-download-file-in-the-active-external-web-service`_	

Welche Schritte, um es zu erweitern;

z.B. Freigabe auf Moodle, API Documentation Moodle, Besonders Download aktivieren und Anleitung verlinken und nochmal erklären, alle möglichen Links, Wie geht man am besten vor,um eine neue API Funktion zu nutzen
Neues Kapitel: Was muss man in Moodle machen, um die richtige Kurs ID etc. in Moodel zu finden. Wie konfiguriert man ein Assignment etc.

If you want to add a new functionality to the Moodle API, these links might be helpful:

1. `Moodle API Documentation <https://docs.moodle.org/310/en/Web_services_API>`_ This site provides an overview of the Moodle API and its functions. If you are looking for a specific topic, e.g. 'submission', you can use this keyword to search for the specific function you need. However this site only contains the name of the functions and a short description. For more detailed information, you can use the following link.
2. `https://github.com/moodle/moodle`_ This link leads you to the Moodle GitHub repository. Here you can find the source code of the Moodle API. If you are looking for a specific function, you can use the search bar to find the function you need. This is helpful if you want to know how the function works and what parameters it needs. Usually the relevant function is located in the 'exterballib.php' file of the module. Next to the function you can find another function with the same name but with the suffix 'parameters'. This function contains the parameters you need to call the function. To get an idea on how to pass the parameters in the correct format in pyton format, take a look at the existing functions.
3. Docker commands to rebuild the moodle api container after modifying the main.py: 
   1. Delete the moodle container in docker
   2. Run 'docker compose -f docker-compose.yml build rpc_moodle_test' to rebuild the container
   3. Run 'docker compose -f docker-compose.yml run -d rpc_moodle_test' to start the container
   4. Run 'make docker' again to rebuild the whole project

Functions
----------------------
The following functions can by called from the frontend:

getUsersFromCourse
----------------------

.. function:: getUsersFromCourse(courseID, options)

    This method retrieves all users from a given course. It then creates a csv file, containing the user information: id, username, firstname, lastname, email and their roles in the course (e.g. student/tutor)
    :param courseID: This is the course id of the course you want to get the users from. You can get it from the URL of the course.
    :type param1: int
    :param options: This parameters holds the URL of the Moodle website and the API token.
    :type param2: dict
    :paramparam options.URL: The URL of the Moodle website.
    :type options.URL: str
    :paramparam options.API_KEY: The API token of the Moodle website.
    :type options.API_KEY: str
    :return: CSV file with the user information.
    :rtype: CSV 
    :raises ExceptionType: Explanation of the exception when it might be raised.
    :raises AnotherException: Another possible exception.

Example Usage
-------------

.. code-block:: python

    example_variable = method_name(param1, param2)

Notes
-----

- Additional details, if any.
- Special considerations, warnings, or performance notes.

getUsersFromAssignment
----------------------

.. function:: getUsersFromAssignment(courseID, assignmentID, options)

    This method retrieves all users from a given assignment. It then creates a CSV file containing user information: ID, username, firstname, lastname, email, and their roles in the course (e.g. student/tutor).

    :param courseID: This is the course ID of the course you want to get the users from. You can get it from the URL of the course.
    :type courseID: int
    :param assignmentID: This is the assignment ID of the assignment you want to get the users from. You can get it from the URL while looking at the assignment.
    :type assignmentID: int
    :param options: A dictionary containing the URL of the Moodle website and the API token.
    :type options: dict
    :param options.URL: The URL of the Moodle website.
    :type options.URL: str
    :param options.API_KEY: The API token of the Moodle website.
    :type options.API_KEY: str
    :return: A CSV file with the user information.
    :rtype: CSV

    :raises Exception: If something goes wrong with the API request.
    :raises AnotherException: Another possible exception.


Example Usage
-------------

.. code-block:: python

    example_variable = method_name(param1, param2)

Notes
-----

- Additional details, if any.
- Special considerations, warnings, or performance notes.



