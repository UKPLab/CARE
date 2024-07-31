import moodle_api
import csv
import json
import requests

# Webservice API Documentation:
# https://docs.moodle.org/401/en/Using_web_services#Enable_capabilities
# List of available functions: https://docs.moodle.org/dev/Web_service_API_functions

# Implementation of externallib functions in Moodle source codes (for parameters and return values):
# https://github.com/moodle/moodle/blob/MOODLE_39_STABLE/mod/assign/externallib.php

# Don't share! This is a secret key for the Moodle API.
moodle_api.URL = "https://moodle.informatik.tu-darmstadt.de"
moodle_api.KEY = "REDACTED_SECRET"

class User :
    def __init__(self, id, fullname, role):
        self.id = id
        self.fullname = fullname
        self.role = role

    def __str__(self):
        return f"User {self.id}: {self.fullname} ({self.role})"
    
def create_csv_with_users_from_course(course_id, filepath, MOODLE_API_KEY, MOODLE_URL):
    # Set the URL and the key for the Moodle API
    moodle_api.URL = MOODLE_URL
    moodle_api.KEY = MOODLE_API_KEY
    
    # Get users from the course
    course_users = moodle_api.call('core_enrol_get_enrolled_users', courseid=course_id)
    
    #print(course_users)
    
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
            

if __name__ == '__main__':
    #print(moodle_api.CourseList())
    """
    Get a list of :class:`MoodleSubmission` objects for this assignment.
    """
    course5 = moodle_api.call('mod_assign_get_assignments', courseids=[1615])
    #print(course5)

    course5 = moodle_api.call('mod_assign_get_submissions', assignmentids=[6082])
    #print(course5)
    
    

    #course5 = moodle_api.call('core_files_get_files', filepath="https://moodle.informatik.tu-darmstadt.de/webservice/pluginfile.php/277223/assignsubmission_file/submission_files/1046711/UKP.png")
    #print(course5)
    
    create_csv_with_users_from_course(1615, 'users.csv', moodle_api.KEY, moodle_api.URL)
    
    #Match user ids with assignment ids
    course5 = moodle_api.call('mod_assign_get_user_mappings', assignmentids=[6350])
    #print(course5)
    
    #course5 = moodle_api.call('mod_assign_get_grades', assignmentids=[6350])
    #print(course5)
    
    test = moodle_api.call('core_grade_update_grades', source='test', courseid=1615, component='mod_assign', activityid=6350, itemnumber=0, grades=[], itemdetails=[])
    'https://gitlab.pavlovia.org/Alex22671/asd.git'
    
    
    userFeedback = {
        'assignmentid': 6350,
        'applytoall': False,
        'grades':
        [{'userid': 14555, 'grade': 50, 'attemptnumber': 1, 'addattempt': False, 'workflowstate': 1, 'plugindata': {}, 'advancedgradingdata': {}}]}
    
    feedbackpluginparams = {
    'files_filemanager': 0,
    'assignfeedbackcomments_editor': {
        'text': '',
        'format': 1
    }
}
    grades = []
    
    student1 = {'userid': 12237, 'grade': 50, 'attemptnumber': 0, 'addattempt': False, 'workflowstate': 'released', 'plugindata': feedbackpluginparams}
    
    grades.append(student1)
    
    
    params = {'assignmentid': 6350, 'applytoall': False, 'grades': grades}
    
    #test = moodle_api.call('mod_assign_save_grades', **params)
    
    test = moodle_api.call('mod_assign_save_grade', assignmentid=6350, userid=12237, grade=50, attemptnumber=-1, addattempt=False, applytoall = False, workflowstate='released')
    
    import requests

    token = 'REDACTED_SECRET'  # the teacher's security key
    domainname = 'https://moodle.informatik.tu-darmstadt.de'  # the Moodle server
    functionname = 'mod_assign_save_grades'  # the web service function we are testing

    grades = []
    plugindata = {
        'assignfeedbackcomments_editor': {'text': '', 'format': 1},
        'files_filemanager': 0
    }
    grades.append({
        'userid': 12237,
        'grade': 50,
        'attemptnumber': -1,
        'addattempt': True,
        'workflowstate': 'released',
        'plugindata': plugindata
    })
    grades.append({
        'userid': 13328,
        'grade': 75,
        'attemptnumber': -1,
        'addattempt': True,
        'workflowstate': 'released',
        'plugindata': plugindata
    })

    params = [{
        'assignmentid': 6350,
        'applytoall': False,
        'grades': grades
    }]

    # The REST web service call
    

    response = moodle_api.call('mod_assign_save_grades', **params[0])
    #print(response.text)
    
    response = moodle_api.call('mod_assign_save_grades', assignmentid=6350, userid=13328, grade=50, attemptnumber=1, addattempt=False, workflowstate='released', plugindata=plugindata, advancedgradingdata=json.dumps({}))
    #print(response.text)
    'https://github.com/moodle/moodle/blob/1a33da66378c307e50b29f9a5f2a7d3888da8f09/mod/assign/externallib.php#L2097'
    'https://github.com/moodle/moodle/blob/1a33da66378c307e50b29f9a5f2a7d3888da8f09/mod/assign/tests/externallib_test.php#L1349'
    
'''
    parameters = {
    'wstoken': moodle_api.KEY,
    'moodlewsrestformat': 'json',
    'wsfunction': 'mod_assign_save_grades',
    'assignmentid': 6350,
    'applytoall': False,
    'grades[0][userid]': 1187303,
    'grades[0][grade]': 50.0,  # Ensure the grade is a float
    'grades[0][attemptnumber]': 1,
    'grades[0][addattempt]': False,
    'grades[0][workflowstate]': 'graded',  # Ensure the state is a string
    'grades[0][plugindata]': json.dumps({}),  # Default empty structure
    'grades[0][advancedgradingdata]': json.dumps({})  # Default empty structure
}
    response = requests.post(moodle_api.URL, data=parameters)
    
    response_data = response.json()
    
    # Check if the response contains any error messages
    if 'exception' in response_data:
        print("API Error:", response_data['message'])
    else:
        # Assuming the absence of 'exception' means success
        print("Success:", response_data)
        
'''



    
    
   

