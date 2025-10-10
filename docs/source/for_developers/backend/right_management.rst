Right Management
================

CARE has several roles, each with different rights on the platform. 
The admin has full rights on the platform, 
while other roles may need to be granted additional rights
as the platform develops. Therefore, developers need to review this
document to understand the current rights of each role (to avoid adding
rights that have already existed or using rights in a wrong way) and to
understand how to add rights for the corresponding roles in the
database. For a list of roles in CARE, please refer to the `Role Definitions and Rights`_ section.

Looking up Existing Rights
--------------------------

Before adding any rights to the database, please first confirm whether the 
corresponding role already holds the specified right. 
You can check the ``role_right_matching`` table, 
which records the current rights assigned to all roles.

Adding a New Right
------------------

1. To add rights for a role, first, please go to the
   ``backend/db/migrations/{timestamp}-basic_user_right.js`` file. The
   ``userRights`` variable stores the existing rights as follows. You
   can directly add new rights to the ``userRights`` array.

.. code-block:: javascript

   const userRights = [
     {
       name: "backend.socket.user.getUsers.student",
       description: "access to get all students",
     },
     {
       name: "backend.socket.user.getUsers.mentor",
       description: "access to get all mentors",
     },
     {
       name: "frontend.dashboard.users.view",
       description: "access to view users on the dashboard",
     },
     // Please add more rights here...
   ];


.. note::

   Please note that right names should follow the established naming schema. For naming conventions, please refer to the following `Naming Schema for Rights`_.


1. After adding the rights, please go to the
   ``backend/db/migrations/{timestamp}-basic_role_right.js`` file to
   assign the rights to the corresponding roles. The ``roleRights``
   variable stores the rights held by each role as follows:

.. code-block:: javascript

   const roleRights = [
     {
       role: "teacher",
       userRightName: "backend.socket.user.getUsers.student",
     },
     {
       role: "teacher",
       userRightName: "backend.socket.user.getUsers.mentor",
     },
     // Please assign more rights to the corresponding roles here...
   ];

Naming Schema for Rights
~~~~~~~~~~~~~~~~~~~~~~~~

1. Use periods (“.”) to separate each part of the name.
2. Prefix: “frontend” / “backend”

-  For backend:

   - “socket”
   - Name of the socket
   - Functionality of the socket
   - Right level on that socket (e.g., all / any / me)

-  For frontend:

   - As defined in settings table, use the route name
   - component
   - specific right

-  For verifying if an access matches a given right, use exact matching.

**Naming schema examples:**

1. backend.socket.role.getUsers.student
2. frontend.dashboard.users.view

.. note::

   When operations involve checking if the user has certain right to perform certain actions (e.g., access to view all students), please use ``hasAccess`` method in ``backend/webserver/Socket.js``, instead of ``isAdmin`` to execute this checking. The ``isAdmin`` method now exists only for historical reasons.

Role Definitions and Rights
---------------------------

Below is a list of the roles currently available in CARE, along with additional information about the rights associated with each role:

- **Admin**: Has full access to all features and settings. Admins can create and assign studies, manage users and roles, and edit platform settings. They automatically have access to everything that other roles can do.  

- **Teacher**: Coordination role. Teachers can view studies, inspect sessions, see user information (like names and emails), and query lists of students or mentors through the backend. They usually prepare and manage study workflows but do not have full system control.  

- **Mentor**: Support role. Mentors can open and read studies, inspect sessions in read-only mode, and view user information related to those studies. They cannot manage users or assign studies.  

- **Student**: Study participant. Students join study sessions. They normally only see their assigned documents. More rights can be added if the study setup requires it.  

- **User**: Standard CARE account. Users can log in, view documents and tags, open projects, join study sessions, and view studies. They form the base role for participants outside of special workflows.  

- **Guest**: Very limited access. Guests can view demo documents and dashboards but cannot upload content or join studies. They are meant for trying the system without registration.  

Current Rights
--------------

This table shows which rights are assigned to which roles.  
Admins can do everything, so they are not listed separately in each row.

.. list-table::
   :header-rows: 1
   :widths: 30 40 30

   * - Capability
     - Right
     - Roles (besides admin)

   * - View Documents dashboard
     - ``frontend.dashboard.documents.view``
     - guest, user

   * - View Tags dashboard
     - ``frontend.dashboard.tags.view``
     - guest, user

   * - View Projects dashboard
     - ``frontend.dashboard.projects.view``
     - guest, user

   * - View Study Sessions dashboard
     - ``frontend.dashboard.study_sessions.view``
     - guest, user

   * - View Studies
     - ``frontend.dashboard.studies.view``
     - guest, user, mentor, teacher

   * - View Studies (read-only)
     - ``frontend.dashboard.studies.view.readOnly``
     - user, mentor, teacher

   * - See user private info in Studies
     - ``frontend.dashboard.studies.view.userPrivateInfo``
     - mentor, teacher

   * - List users (students)
     - ``backend.socket.user.getUsers.student``
     - teacher

   * - List users (mentors)
     - ``backend.socket.user.getUsers.mentor``
     - teacher