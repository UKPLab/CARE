import moodle_api
import csv
import json
import requests
import random

# Webservice API Documentation:
# https://docs.moodle.org/401/en/Using_web_services#Enable_capabilities
# List of available functions: https://docs.moodle.org/dev/Web_service_API_functions

# Implementation of externallib functions in Moodle source codes (for parameters and return values):
# https://github.com/moodle/moodle/blob/MOODLE_39_STABLE/mod/assign/externallib.php

# Don't share! This is a secret key for the Moodle API.
moodle_api.URL = "https://moodle.informatik.tu-darmstadt.de"
moodle_api.KEY = "REDACTED_SECRET"
    
class User:
    def __init__(self, id, fullname, role):
        self.id = id
        self.fullname = fullname
        self.role = role    

def create_csv_with_users_from_course(course_id, filepath, MOODLE_API_KEY, MOODLE_URL):
    """
    Creates a CSV file with users from a Moodle course, containing their ID, role and name.

    Args:
        course_id (int): The ID of the Moodle course.
        filepath (str): The path to the CSV file to be created.
        MOODLE_API_KEY (str): The API key for accessing the Moodle API.
        MOODLE_URL (str): The URL of the Moodle site.

    Returns:
        None
    """
    # Set the URL and the key for the Moodle API
    moodle_api.URL = MOODLE_URL
    moodle_api.KEY = MOODLE_API_KEY
    
    # Get users from the course
    course_users = moodle_api.call('core_enrol_get_enrolled_users', courseid=course_id)
    
    # Create a list of User objects
    users = []
    
    for user in course_users:
        users.append(User(user['id'], user['fullname'], user['roles'][0]['name']))
    
    header = ['id', 'fullname', 'role']

    with open(filepath, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=header)

        writer.writeheader()

        for user in users:
            person_data = {attr: getattr(user, attr) for attr in header}
            writer.writerow(person_data)
           
def create_csv_with_users_from_assignment(course_id, assignment_name, filepath, MOODLE_API_KEY, MOODLE_URL):
    """
    Create a CSV file with users enrolled in a specific assignment.

    Args:
        course_id (int): The ID of the course.
        assignment_name (str): The name of the assignment.
        filepath (str): The path to the CSV file to be created.
        MOODLE_API_KEY (str): The API key for accessing the Moodle API.
        MOODLE_URL (str): The URL of the Moodle site.

    Returns:
        None

    Raises:
        None
    """
    moodle_api.URL = MOODLE_URL
    moodle_api.KEY = MOODLE_API_KEY
    
    assign_ids_with_names = get_assignment_ids_from_course(course_id)
    assignment_id = -1
    
    for assignment in assign_ids_with_names:
        if assignment[1] == assignment_name:
            assignment_id = assignment[0]
            break
        
    if assignment_id == -1:
        print("Assignment not found. The assignment name is case sensitive.")
        return
    
    course_users = moodle_api.call('core_enrol_get_enrolled_users', courseid=course_id)
    
    # Create a list of User objects
    users = []
    id_mappings = get_id_mappings(assignment_id)
    
    for user in course_users:
        for id in id_mappings:
            if id['userid'] == user['id']:
                users.append(User(user['id'], user['fullname'], user['roles'][0]['name']))
                continue
    header = ['id', 'fullname', 'role']

    with open(filepath, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=header)

        writer.writeheader()

        for user in users:
            person_data = {attr: getattr(user, attr) for attr in header}
            writer.writerow(person_data)
    
def upload_passwords_to_moodle(assignment_id, csv_filepath, MOODLE_API_KEY, MOODLE_URL):
    """
    Uploads passwords as feedback to Moodle for a given assignment.

    Args:
        assignment_id (int): The ID of the assignment in Moodle.
        csv_filepath (str): The filepath of the CSV file containing the passwords and the user IDs.
        MOODLE_API_KEY (str): The API key for accessing the Moodle API.
        MOODLE_URL (str): The URL of the Moodle instance.

    Returns:
        None
    """
    moodle_api.URL = MOODLE_URL
    moodle_api.KEY = MOODLE_API_KEY
    
    with open(csv_filepath, mode='r') as file:
        csv_reader = csv.DictReader(file)
        for row in csv_reader:
            parameters = {}
            parameters['assignmentid'] = assignment_id
            parameters['userid'] = row['id']
            parameters['grade'] = 100
            parameters['attemptnumber'] = 1
            parameters['addattempt'] = 1
            parameters['workflowstate'] = 'Graded'
            parameters['applytoall'] = 0
            parameters['plugindata[assignfeedbackcomments_editor][text]'] = 'CARE Password: ' + str(row['key'])
            parameters['plugindata[assignfeedbackcomments_editor][format]'] = 0
            parameters['plugindata[files_filemanager]'] = 0
            moodle_api.call('mod_assign_save_grade', **parameters)
            
        
def get_assignment_ids_from_course(course_id):
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

def get_id_mappings(assignment_id):
    """
    Retrieve the ID mappings for a given assignment.

    Parameters:
    - assignment_id (int): The ID of the assignment.

    Returns:
    - list: A list of tuples containing the general user ID and the assignment user ID.
    """
    return moodle_api.call('mod_assign_get_user_mappings', assignmentids=[assignment_id])['assignments'][0]['mappings']

import csv
import random

def insert_random_keys(csv_path):
    """
    Inserts random keys into a CSV file.

    Args:
        csv_path (str): The path to the CSV file.

    Returns:
        None
    """
    key_column = 'key'
    keys = []
    
    with open(csv_path, mode='r') as file:
        csv_reader = csv.DictReader(file)
        rows = [row for row in csv_reader]
        
    keys = [random.randint(1000, 9999) for _ in rows]
    
    key_column = 'key'
    
    if rows:
        fieldnames = csv_reader.fieldnames + [key_column]

        for row, key in zip(rows, keys):
            row[key_column] = key

        with open(csv_path, mode='w', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
            
def get_submissions_of_assignment(course_id, assignment_id, MOODLE_API_KEY, MOODLE_URL):
    """
    Get a list of submissions for a given assignment.

    Args:
        assignment_id (int): The ID of the assignment.
        MOODLE_API_KEY (str): The API key for accessing the Moodle API.
        MOODLE_URL (str): The URL of the Moodle instance.

    Returns:
        list: A list of submissions.
    """
    moodle_api.URL = MOODLE_URL
    moodle_api.KEY = MOODLE_API_KEY

    # Get users from the cosurse
    course_users = moodle_api.call('core_enrol_get_enrolled_users', courseid=course_id)
    
    # Create a list of User objects
    users = []
    
    for user in course_users:
        users.append(User(user['id'], user['fullname'], ', '.join([role['name'] for role in user['roles']])))

    submissions = moodle_api.call('mod_assign_get_submissions', assignmentids=[assignment_id])

    file_paths = []

    for sub in submissions['assignments'][0]['submissions']:
        fullname = ''
        for user in users:
            if sub['userid'] == user.id:
                fullname = user.fullname
                break
        file_paths.append('submissions/' + str(sub['userid']) + '_' + fullname)
        for plugin in sub['plugins']:
            if 'fileareas' in plugin:
                for filearea in plugin['fileareas']:
                    fileIndex = 0
                    for files in filearea['files']:
                        file_url = files['fileurl']
                        file_url += f'?token={MOODLE_API_KEY}'
                        response = requests.get(file_url)
                        newPath = 'files/' + str(sub['userid']) + '_' + fullname + '_' + str(fileIndex) + '.pdf'
                        with open(newPath, 'wb') as file:
                            file.write(response.content)
                        fileIndex += 1
                        
                        
        

if __name__ == '__main__':
    #create_csv_with_users_from_assignment(1615, 'TANs', 'users.csv', 'REDACTED_SECRET', 'https://moodle.informatik.tu-darmstadt.de')
    #insert_random_keys('users.csv')
    #upload_passwords_to_moodle(6350, 'users.csv','REDACTED_SECRET', 'https://moodle.informatik.tu-darmstadt.de')
    #subs = moodle_api.call('mod_workshop_get_submission', assignmentids=[6350])
    #sub = moodle_api.call('', workshopid=6350)
    #print(subs)
    get_submissions_of_assignment(1615, 6350, 'REDACTED_SECRET', 'https://moodle.informatik.tu-darmstadt.de')
    #course = moodle_api.call('mod_assign_get_assignments', courseids=[1615])
    #print(course)
    #moodle_api.call('core_course_get_course_module', cmid=6350)
    
    



    
    
   

