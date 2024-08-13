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
       userRoleName: "teacher",
       userRightName: "backend.socket.user.getUsers.student",
     },
     {
       userRoleName: "teacher",
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

1. Admin: Full access to all features and settings on the platform.
2. Teacher: Responsible for coordination.
3. Mentor: Have the right to grade.
4. Student: Have the right to leave inline commentary.
