from moodle_api import moodle_api
import requests
from User import User


class Moodle:
    def __init__(self, api_key, url, endpoint="/webservice/rest/server.php"):
        self.api_key = api_key
        self.url = url
        self.endpoint = endpoint
        moodle_api.URL = url
        moodle_api.KEY = api_key
     
     
    def create_users_from_course(self, course_id):
        """
        Create a list of user dictionaries from a given course.
        This method retrieves users enrolled in a specified course and returns a list of dictionaries containing user details.
        Args:
            course_id (int): The ID of the course from which to retrieve users.
        Returns:
            list: A list of dictionaries, each containing the following user details:
                - id (int): The user's ID.
                - firstname (str): The user's first name.
                - lastname (str): The user's last name.
                - username (str): The user's username (currently an empty string).
                - email (str): The user's email address.
                - roles (str): A comma-separated string of the user's roles.
        """
        
        
        # Get users from the course
        course_users = moodle_api.call('core_enrol_get_enrolled_users', courseid=course_id)
        
        users = []
        
        for user in course_users:
            roles = ''
            for role in user['roles']:
                roles += role['name'] + ', '
            
            email = user['email'] if 'email' in user else ''
            user_dict = {
                'id': user['id'],
                'firstname': user['firstname'],
                'lastname': user['lastname'],
                'username': "",  
                'email': email,
                'roles': roles[:-2]  
            }
        
            users.append(user_dict)
        
        return users
    
    def get_assignment_ids_from_course(self, course_id):
        """
        Retrieves the assignment IDs and names from a given course.

        Args:
            course_id (int): The ID of the course.

        Returns:
            list: A list of tuples containing assignment IDs and names.
        """
        course_assignments = moodle_api.call('mod_assign_get_assignments', courseids=[course_id])
        
        assign_ids_with_names = []
        
        for assignment in course_assignments['courses'][0]['assignments']:
            assign_ids_with_names.append((assignment['id'], assignment['name']))
            
        return assign_ids_with_names

    def get_id_mappings_for_users(self, assignment_id):
        """
        Retrieve the ID mappings for a given assignment.

        Parameters:
        - assignment_id (int): The ID of the assignment.

        Returns:
        - list: A list of tuples containing the general user ID and the assignment user ID.
        """
        return moodle_api.call('mod_assign_get_user_mappings', assignmentids=[assignment_id])['assignments'][0]['mappings']

    def get_id_mapping_for_assignment(self, course_id, assignment_cmid):
        """
        Retrieve the ID mappings for all assignments in a course.

        Parameters:
        - course_id (int): The ID of the course.

        Returns:
        - list: A list of tuples containing the general user ID and the assignment user ID.
        """
        course_assignments = moodle_api.call('mod_assign_get_assignments', courseids=[course_id])
        
        assignment_cmid = int(assignment_cmid)
        
        for assignment in course_assignments['courses'][0]['assignments']:
            if assignment['cmid'] == assignment_cmid:
                return assignment['id']
        
        return "Assignment not found."
            
    def create_users_from_assignment(self, course_id, assignment_cmid, moodle_api_key, moodle_url):
        """
        Create a list of user dictionaries from a given assignment in a course.
        This method retrieves users enrolled in a specified assignment in a specific course and returns a list of dictionaries containing user details.
        Args:
            course_id (int): The ID of the course from which to retrieve users.
        Returns:
            list: A list of dictionaries, each containing the following user details:
                - id (int): The user's ID.
                - firstname (str): The user's first name.
                - lastname (str): The user's last name.
                - username (str): The user's username (currently an empty string).
                - email (str): The user's email address.
                - roles (str): A comma-separated string of the user's roles.
        """
        moodle_api.URL = moodle_url
        moodle_api.KEY = moodle_api_key

        # Get users from the course
        course_users = moodle_api.call('core_enrol_get_enrolled_users', courseid=course_id)
        assignment_id = self.get_id_mapping_for_assignment(course_id, assignment_cmid)
        
        users = []
        id_mappings = self.get_id_mappings_for_users(assignment_id)
        
        for user in course_users:
            roles = ''
            for role in user['roles']:
                roles += role['name'] + ', '
            
            email = user['email'] if 'email' in user else ''
            
            user_dict = {
                'id': user['id'],
                'firstname': user['firstname'],
                'lastname': user['lastname'],
                'username': "",  
                'email': email,
                'roles': roles[:-2]  
            }
            
            users.append(user_dict)
        
        return users

        
    def upload_login_data_to_moodle(self, assignment_id, course_id, login_data):
        """
        This method uploads the login data for a list of users to a specific assignment in a Moodle course as feedback.
        Args:
            assignment_id (int): The ID of the assignment to upload data for.
            course_id (int): The ID of the course containing the assignment.
            login_data (list of dict): A list of dictionaries containing login data. Each dictionary
                                       should have the keys 'id', 'username', and 'password'.
        Example:
            login_data = [
                {'id': 1, 'username': 'user1', 'password': 'pass1'},
                {'id': 2, 'username': 'user2', 'password': 'pass2'}
            ]
            upload_login_data_to_moodle(assignment_id=123, course_id=456, login_data=login_data)
        """
        
        
        assignment_id = self.get_id_mapping_for_assignment(course_id, assignment_id)
        
        for entry in login_data:
            parameters = {}
            parameters['assignmentid'] = assignment_id
            parameters['userid'] = entry['id']
            parameters['grade'] = 100
            parameters['attemptnumber'] = 1
            parameters['addattempt'] = 1
            parameters['workflowstate'] = 'Graded'
            parameters['applytoall'] = 0
            parameters['plugindata[assignfeedbackcomments_editor][text]'] = 'CARE Username: ' + entry['username'] + '\nCARE Password: ' + entry['password']
            parameters['plugindata[assignfeedbackcomments_editor][format]'] = 0
            parameters['plugindata[files_filemanager]'] = 0
            moodle_api.call('mod_assign_save_grade', **parameters)
                
            
        
    def get_submission_infos_from_assignment(self, course_id, assignment_cmid, options):
        """
        Retrieves submission information from a specific assignment in a Moodle course.
        Args:
            course_id (int): The ID of the course.
            assignment_id (int): The ID of the assignment.
            options (dict): A dictionary containing the 'url' and 'apiKey' for the Moodle API.
        Returns:
            list: A list of dictionaries, each containing:
                - 'userid' (int): The ID of the user who made the submission.
                - 'submissionURLs' (list): A list of dictionaries, each containing:
                    - 'filename' (str): The name of the submitted file.
                    - 'fileurl' (str): The URL to access the submitted file.
        """
        moodle_api.URL = options['url']
        moodle_api.KEY = options['apiKey']

        
        # Get users from the course
        course_users = moodle_api.call('core_enrol_get_enrolled_users', courseid=course_id)

        assignment_id = self.get_id_mapping_for_assignment(course_id, assignment_cmid)
        
        users = []
        
        for user in course_users:
            roles = ''
            for role in user['roles']:
                roles += role['name'] + ', '
            users.append(User(user['id'], user['firstname'], user['lastname'], "", user['email'], roles[:-2]))

        submissions = moodle_api.call('mod_assign_get_submissions', assignmentids=[assignment_id])     
        
        submission_infos = []  
        
        for sub in submissions['assignments'][0]['submissions']:
            submission_info = {}
            for user in users:
                if sub['userid'] == user.id:   
                    submission_info['userid'] = sub['userid']
                    break
            for plugin in sub['plugins']:
                if 'fileareas' in plugin:
                    for filearea in plugin['fileareas']:
                        submission_urls = []
                        for files in filearea['files']:
                            file_url = files['fileurl']
                            file_url += f'?token={moodle_api.KEY}'
                            file_name = files['filename']
                            submission_urls.append({"filename": file_name, "fileurl": file_url})
            submission_info['submissionURLs'] = submission_urls
            submission_infos.append(submission_info)
        
        return submission_infos
                            
    def download_submissions_from_user(file_urls):
        """
        Downloads files from the given list of URLs.

        Args:
            file_urls (list of str): A list of URLs pointing to the files to be downloaded.

        Returns:
            list of bytes: A list containing the content of each downloaded file.
        """
        files = []
        for file_url in file_urls:
            response = requests.get(file_url)
            files.append(response.content)
        return files   