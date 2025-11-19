# CARE Changelog

## [Unreleased] - 2025-11-07

### Added
- Queue-based document editing system to prevent race conditions during concurrent edits
- Submission workflow for peer review with copying and group assignment
- NLP skill application for document preprocessing and analysis
- Configurable sidebar with collapsible tabs (Annotations, Configurator, History) and automatic dropdown menu for overflow buttons

### Changed
- Frontend class structure improved for maintainability
- Preprocessing views enhanced with better progress tracking
- Document type support extended to include ZIP files for LaTeX submissions

### Fixed
- Data consistency issues in high-concurrency document editing
- NLP modal data loading after closure
- Preprocessed data validation logic
- Submission import transaction errors 
- Tagset annotation workflow bugs 
- Configuration wizard now correctly saves steps when user navigates backward

### Known Issues
- Document edit updates require page refresh to display 
- NLP response loading delay on editor initial load 

---

## [1.10.0] - 2025-10-01

### Added
- Comprehensive documentation covering API design, database schema, and workflow setup for developers 
- Socket.io communication schema documentation with implementation examples
- Database hooks and transaction usage documentation
- Editor integration guide for real-time collaborative editing features
- System analytics scheduler for performance monitoring and query optimization
- Configurable statistics batching to mitigate operation timeouts 

### Changed
- Improved date/time display in history (short format for same dates, full datetime for different dates) 
- Reduced database write amplification through bulk operations
- Enhanced logging with caller metadata (function name, file path, line number) 

### Fixed
- Broker reconnection handling and skill display issues 
- Duplicate skill display when broker disconnects and reconnects 
- HTML/MODAL document creation error ("annotations is not defined") 
- NLP service error event handling for graceful service degradation 

---

## [1.9.0] - 2025-08-18

### Added
- Admin controls for project visibility and user access management 
- Password reset feature with email verification for account recovery 
- NLP skill debugging interface in admin panel for service troubleshooting
- Broker online status indicator showing real-time service availability 
- Configuration management table for storing project-specific settings 
- Order column in document edits database to prevent timestamp collision issues 
- Queue-based document editing system to serialize concurrent edits safely 
- Submission dashboard with import and publishing workflow features
- NLP preprocessing with skill application for document analysis 
- Configurable sidebar with Bootstrap tabs for better UI/UX 

### Changed
- User rights retrieval optimized for application performance 
- Sidebar redesigned with Bootstrap navigation tabs 
- Reduced write amplification through statistics batching 
- Frontend class structure reorganized for maintainability
- Preprocessing views improved with better user feedback 

### Fixed
- Skills display after broker reconnection and service restart 
- Moodle password field mapping for correct credential synchronization 
- Submission import transaction handling ("current transaction is aborted") 
- Guest role sidebar visibility and permission restrictions 
- Text input selection and deselection behavior 
- Admin password reset functionality 

### Security
- Enhanced password reset flow with secure admin bypass for user account management

---

## [1.8.0] - 2025-02-17

### Added
- Comment voting system allowing users to upvote helpful peer feedback 
- Session review links publishing to Moodle for student access 
- Review list export functionality for data analysis and reporting 
- Editor version history with document comparison and restoration capabilities 
- Dynamic Moodle assignment selection via API for flexible integration 
- Review workflow with NLP service integration for processing 
- Workflow configuration storage for managing workflow state
- Chart visualization using Chart.js for workflow analysis results 

### Changed
- Username generation switched from Marvel characters to animal names (copyright compliance)
- User roles now properly save in admin UI without requiring page reload 
- User list now searchable with enhanced filtering capabilities 
- Study workflow wrap-up functionality completed for workflow closure 
- Project database structure updated with proper relationship definitions 
- Filter types expanded to include "greater than" and "less than" operators 

### Fixed
- User role synchronization across all application features 
- Study workflow display issues in coordinator view 
- Moodle password field mapping for bulk user import 
- Stepper component reset after Moodle import completion 
- Moodle bulk user import error handling with user-friendly feedback 
- Duplicate email display and conflict resolution 
- Teacher role assignment during automated imports 

---

## [1.7.0] - 2024-12-10

### Added
- Individual study assignment creation modal with step-by-step configuration 
- Reviewer management interface for editing existing peer review assignments 
- Anonymized peer review mode (displays "Anonymous" instead of reviewer names) 
- Moodle review link generation and automatic upload to assignments 
- Active Sessions dashboard for monitoring real-time study submission progress 
- Student interface for viewing and starting available assignments 
- Teaching assistant workflows with individual assignment number control per instructor 
- Complete study workflow implementation with Moodle integration 
- Study templates for creating and reusing workflow configurations
- Multi-step study coordinator with role-based workflow choices 

### Changed
- Study visibility: users now see only their own created studies 
- Teacher role permissions expanded for assignment management 
- All user roles sent from backend instead of hard-coded values 
- Workflow selection removed from initial dashboard load for performance 

### Fixed
- Study workflow navigation issues and step transitions 
- Mentor access control for viewing other users' study sessions
- Moodle duplicate email conflict handling with proper error messages 
- Active user display during study closure and finalization 

### Known Issues
- Editor documents not automatically updated per workflow steps 

---

## [1.6.0] - 2024-10-27

### Added
- Moodle LMS API integration for user and submission management across platforms 
- Bulk user creation from CSV with step-by-step validation dialog 
- Bulk user import directly from Moodle course enrollment and assignment data 
- Review Documents dashboard for comprehensive submission file management 
- Bulk student submission import from Moodle assignments 
- CARE login credentials automatic upload to Moodle for student onboarding 
- Bulk peer review assignment creation with 4-step configuration wizard 
- Copy/paste action tracking in editor for user behavior analysis 

### Changed
- Moodle connection details stored as default settings for easy reuse

### Fixed
- Moodle bulk user import error handling with user-friendly feedback 
- Duplicate email display and conflict resolution on frontend 
- CSV credential download after successful user import 
- Teacher role assignment during automated imports 

### Known Issues
- Username generation uses copyrighted character names (scheduled for replacement) 
- Sensitive data column encryption not yet implemented 

---

## [1.5.0] - 2024-09-06

### Added
- Role-based access control (RBAC) with four user roles (Admin, Teacher, Mentor, Student) and granular permissions 
- Teacher dashboard for student-mentor matching and management 
- Rich text editor (Quill.js) with real-time WebSocket collaboration for documents 
- Remote Procedure Call (RPC) infrastructure for executing resource-intensive code in isolated Docker containers 
- User interaction logging system for tracking behavior and generating analytics 
- Consent modal for behavioral data collection opt-in on user first login 
- Delta persistence to disk for improved editor performance and reduced database load
- Search functionality with full-text search support 
- PDF document search integrated with viewer 
- Chat interface with message sending/receiving and bot responses 
- Question answering system integrated into chat using PDF content
- Survey/questionnaire administration dashboard 
- Questionnaire creation with file upload and storage 
- Questionnaire preview functionality before deployment 
- Questionnaire distribution and participant response collection 
- Results export in CSV and JSON formats for data analysis 

### Changed
- Delta format persistence moved to disk to reduce database load 
- Critical destructive actions now require user confirmation

### Fixed
- Login redirect now works correctly for direct study links without full reload 
- Admin user statistics table functionality restored
- Document access without requiring full page reload

### Known Issues
- Role changes require explicit page refresh to reflect in UI 
- Search detection limited to Ctrl+F or Cmd+F keyboard shortcuts 

### Security
- Backend validation enforces role-based permissions for all user actions 
- Behavioral data tracking requires explicit user consent

---

## [1.4.0] - 2024-03-03

### Added
- Chat interface with message sending, receiving, and bot responses 
- Question answering system integrated into chat 
- PDF content extraction and analysis for document-based Q&A 
- Survey/questionnaire administration dashboard for creating and managing surveys
- Questionnaire creation with file upload and database storage 
- Questionnaire preview functionality before distribution
- Questionnaire participant distribution and response collection 
- Results export in CSV and JSON formats 
- Instructional guide modal for questionnaire workflows
- Questionnaire management dashboard with CRUD operations 
- Full-text search functionality 
- PDF document search integrated with viewer 

### Changed
- Chat history and PDF context now sent together to backend for improved Q&A accuracy 

---

## [1.3.0] - 2023-12-03

### Added
- Sidebar component with button-based content selection and switching
- PDF rendering optimization for high-DPI displays (render at 2x size and shrink via CSS)

### Fixed
- PDF resolution issues on high-DPI displays (verified on non-Mac devices)

### Known Issues
- PDF resolution cannot be tested on Mac high-resolution displays
- Sidebar show/hide functionality planned for future release

---

## [1.2.0] - 2023-11-21

### Added
- Initial sidebar component infrastructure
- PDF resolution enhancement for improved display quality

---

## [1.1.0] - 2023-10-27

### Added
- Core PDF viewer functionality 
- Basic sidebar component for content organization
- Annotation system foundation for document markup

---

## [ACL-Release] - 2023-07-06

### Added
- Renaming documents is possible now via the basic form modal in dashboard.
- Input verification on forms (also checked by the backend); provide clear feedback.
- NLP Skill debugging in the admin interface.
- Message interface to specific models.
- Reading of configurations.
- Downloading and copying.
- Broker online status.
- Auto-tables feature: automatic publishing database tables in vuex store.
- Coordinators for basic forms from auto tables - described as a dictionary.
- Fetch plugin for auto tables in frontend components.
- Kill command for conveniently stopping dangling node processes (only unix).
- Linter integration.

### Changed
- Critical actions (like deletion etc.) now require confirmation by the user.
- Live updates on study participants: the host of a study can now view the status of studies in real time in the study dashboard.
- Services now describe themselves and hereby configure the vuex store dynamically.
- Documentation for running the tool locally on Windows.
- Refactored base components.
- Updated NLP service interface to work with the new broker message interface.
- All components that can be standardized now use base components in the dashboard.

### Fixed
- Redirect after login works; e.g. when receiving a study link, you can open, login and access the study directly.
- Admin user stats table works now.
- Accessing a new document without loading the whole page is possible now.

### Known Issues
- Tables that are too large overlap the website (overflow).
- NLP Bot replies are not forwarded to the collaborators (concerns summarization tasks).
- Saving an annotation card while adding a tag (not “committed” to a badge yet), the content is not saved.
- Disconnects during non-resumable studies cause that you cannot continue on that session and may lose the data/cannot continue. This should have an explicit mechanism: also for other situations this should be considered, but for studies this is especially important. Tested for connectivity disruptions of >10s. For disruptions of 1-2s this does not seem a problem.

### Future Steps
- Dealing with large tagsets.
- Document Access/Group Management.
- Supporting non-pdf documents.

---

## [Public-Release] - 2023-02-24

### Added
- Study Coordination It is possible to run a user study on a document. Various settings can be specified, such as the name, a description or a time limitation. Collaborative studies are also possible as well as an evaluation of the results.
- NLP Pipeline NLP functionality has been integrated as a service, currently with two examples, sentiment classification and summarization. Basic components are available to simplify integration.
- Documentation A complete documentation of the software is now available. This includes the installation, the extension as a developer and the usage as a researcher. This is supplemented by a documentation of the backend API.
- Sharing Documents It is now possible to share a document with other users via a link.
- Admin Area The admin area now supports setting preferences directly in the frontend, as well as viewing and downloading user statistics.
- Collaboration Collaboration in the annotation view is supported now. Thereby, editing is indicated and new annotations or comments are made available immediately to all document viewers when saving. It is also possible to reply to annotations and comments.
- Generic DB Methods The existing database methods were generalized in order to accelerate the development of the backend.
- Backend API Tests Extensive tests in the backend ensure the functionality of the API.
- Basic Frontend Components Predefined Frontent Component can be used to support faster and consistent implementations.
- Bootstrap Icons The use of icons was standardized, we supporting all available bootstrap icons by simple naming them.
- @Alias in Frontend The integration of new components can now be done via the basic path and the usage of the @resolving
- Broker Fallback Standardized configuration files can be included to emulate a fallback (default response), which enhances development when no broker is available.

### Changed
- Increasing usability in annotator
- The display and creation of PDF pages has been fundamentally redesigned to increase performance. At the same time, individual PDF pages are loaded dynamically, so that even very large PDF files (with many pages) are supported.
- Page information in annotation data
- In the annotation data the information about the current PDF page was added
- “make clean” also delete uploaded files

### Fixed
- Display username on annotation cards
- Admin Tabs in dashboard navigation are no longer displayed to normal users
- Fixed upload

### Known Issues
- When opening the website with a published link, it is necessary to manually call the link a second time after the actual login of the user (applies only to users not already logged in)
- Tables that are too large overlap the website (overflow)
- Admin user stats table selects rows that cannot be unselected in the stats table
- NLP Bot replies are not forwarded to the collaborators (concerns summarization tasks).

### Future Steps
- Adding confirmation modal before leaving a pages with drafts
- Dealing with large tagsets
- Document Access/Group Management
- Loading response on action events

---

## [0.1.2-alpha-dagstuhl] - 2022-10-21

### Added
- Export Function: In the documents view users can download all annotations that were created within their documents. The output is one CSV per document containing all annotations.
- In the annotator view, users can download all annotations present in the sidebar. Later on this will be updated to export exactly what’s seen in the sidebar.
- Dashboard: Now there is a top bar in the dashboard and all subsequent views. This top bar shows a home button if not in the dashboard home and it may show some buttons depending on the context. The top bar also offers access to the profile page, logout etc.
- There is a sidebar in the dashboard which loads the functionalities available to me. There is a default set of functionalities including: home, document overview, review overview and the tag management. The sidebar is collapsable.
- Tagsets: There is a tag management component, where users can create new tag sets, copy others, change existing ones and publish their tagsets to everyone. Users can select the tagset, which they want to use for their current annotations.
- Dynamic Component Loading: The dashboard now loads components dynamically from a settings configuration from the backend. Adding a new component hence means adding an entry to the database and providing the vue components for compilation. This is basically the gateway to the future integration of plugins; for now, it is very convenient to add new functionalities to the dashboard.
- Dynamic Route Loading: To support this, routes are now dynamically added on the dashboard. Components are also loaded dynamically. The dashboard sidebar loads the routes dynamically depending on the global and user settings.
- Dynamic Icon Loading: Icons have been introduced as individual components; a default icon is loaded in case of errors.
- Settings: The vuex store now contains the user settings and global settings, all necessary tags and the available tagsets.

### Changed
- Improved dashboard structure.
- Improved Adder and Sidebar components to load tag configurations from store.

### Fixed
- Fixed broken links on various buttons – now using proper routing.
- Fixed user names in the frontend: now user names instead of IDs are shown consistently.
- Fixed issue of highlights across pages – now users cannot select start and end points residing on different pages.

### Known Issues
- Export currently shows tag IDs instead of tag names (and IDs).
- Some convenience features for edge cases are missing: deleting a selected tagset, Pagination, filtering, ordering.
- When the tagset changes but annotations already exist in a document, the annotation cards allow users to remove and add the previously existing tag again while editing.
- Only one review process per document is possible. See previous release.
- Some icons are not bootstrap icons, they need to be fixed in the future.
- Overflowing of tables in the dashboard (e.g. documents).
- Loader.vue seems redundant with Loading.vue.
- User name is still not shown in the annotation card for newly created annotations; only on refresh.
- Loading icon missing for annotator sidebar when waiting for annotations from the server.
- Dashboard components themselves need revision – no admin sub view in home etc.
- Report generation in the approval view does not work.

### Future Steps
- Updating the export functionality to show tag names in addition to IDs.
- The annotator-based export should show the annotations in the order and filtering as seen in the sidebar to make this a you-see-is-what-you-get export.

---

## [0.1.1-alpha-cais] - 2022-08-24

### Added
- Reduced dashboard interface streamlined for CAIS
- Review process mechanism: Reviews of documents can be started, continued and submitted.
- Editor view: Editors of a paper can view a review in read-only mode and make acceptance decisions.
- Meta-review list: There is a list of pending meta-reviews in the dashboard of editors.
- Color-coded highlights: Highlights are now color coded according to the color of the first tag of an annotation.
- Report generation: A basic report consisting of a list of annotations structured by tags can be viewed by editors. The report is interactive and allows to switch between the PDF-Sidebar and the report view (in a modal).
- Document notes: Reviewers can add comments without anchors in the text now.
- Top bar: In the annotator view there is a topbar offering context-dependent functionalities.
- Admin dashboard: There is a basic admin dashboard parallel to the respective user dashboard. Admins can manage reviewing in this view.
- Usability: Added support for user feedback through bootstrap toasts.
- Automatic gitlab deployment pipeline
- Multiple environments supported depending on context (dev/production)
- Modals as vue template
- Detailed user statistics logging
- Logging into database

### Changed
- Revised highlighting mechanism (robust, compatible, efficient)

### Fixed
- Regular session updates through websocket to prevent expiration
- Fixed IP address of the postgres host to support Mac environments

### Known Issues
- User names are not correctly shown in the sidebar – either IDs on reload or not at all on new annotations
- Only one review workflow supported per document

### Future Steps
- Automatic unit tests for the backend
- Transferring the experimental NLP server coupling to work in production and serve several convenience features via a clearly defined API
- Review Process Workflow as a module/plugin
- Code Refactoring

---

## [0.1.0-alpha] - 2022-07-13

### Added
- Color-coded annotation tagging with drop-down
- Simplified and clean commenting interface
- Annotator top bar
- All data via websockets (except login) with easy vuex access
- DB migration management with sequelize
- Complete vue.js 3 implementation of the front-end (incl. PDF page rendering)
- Full vite-based development support
- No dependencies to hypothesis (i.e., updates)

### Changed
- Customized annotation sidebar
- Detailed logging of annotation creation in the database

### Fixed
- Fixed hypothesis-induced issue of same PDF uploads with synchronized annotations
- Automatic login into hypothesis obsolete and hereby fixed
- Database ports can be adapt freely now
- init.js replaced with DB migration management, reduced error handling

### Known Issues
- Easy highlighting vs. annotating (Adder; highlight functionality) not realized
- When not submitting an annotation but doing something new, we should have a default behavior: either discard or submit.
- Rendering of PDF pages on demand (when they become visible) is not possible.
- Communication over the websocket should update the session validity duration
- Synchronization of multiple views of the same paper page not realized
- Loading of documents with many annotation takes a lot of time (browser hangs sometimes)

---

## [Alpha] - 2022-06-09

### Added
- Login Management (i.e., Registration, Login, Guest login)
- Dashboard with Document Overview (i.e., List, Upload, Delete)
- PDF Viewer with Hypothesis Sidebar
- Automatic user login in Hypothesis
- Easy-to-use building scripts parameterized via .env-file
- Complete dockerization
- Basic architecture overview
- Basic documentation
- Streamlined building tools

### Changed
- — no previous release

### Fixed
- — no previous release

### Known Issues
- Multiple uploading of the same PDF files synchronizes annotations on all documents despite residing on different URLs
- No error handling and loading information in frontend
- Automatic login in hypothesis breaks after too many logins
- Database ports cannot be adapted during building; have to remains standard ports
- Error handling during initialization lacks details in outputs
- Production build does not work yet; login fails with an error.
- Production build port needs to be 3001, does not support 80

### Future Steps
- Replacing the hypothesis client through an individual vue component
- Updating error handling and information feedback in frontend
- Exchanging http-endpoints (on /api/..) by websocket messaging
- Initialization of the database with version management
- Automatic deployment
- Automatic testing

---

## [Vanilla-Prototype] - 2022-04-05

### Added
- The vanilla prototype version supports the simple integration of Hypothesis for annotating PDF files. PDFjs is used to view the PDF. No additional features are implemented.

### Purpose
- This version is intended to serve as a starting point to integrate additional features and enable bias free development.

### Additional Notes
- Both, the development as well as the production version are stable on a freshly installed Ubuntu 20.04 LTS.

---

## Glossary & Context

**Moodle**: Open-source learning management system for institutional course management. CARE integrates with Moodle to manage students, assignments, and submissions.

**NLP**: Natural Language Processing for document analysis and information extraction.

**WebSocket**: Real-time bidirectional communication protocol used for collaborative editing.

**Delta Format**: Compressed representation of document changes for efficient synchronization.

**RPC (Remote Procedure Call)**: Infrastructure for executing code in isolated environments (Docker containers) and retrieving results.

 

