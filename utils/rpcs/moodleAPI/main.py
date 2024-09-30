import logging
import socketio
from Moodle import Moodle

__author__ = "Alexander Bürkle, Dennis Zyska"

def create_app():
    """
    # Webservice API Documentation:
    # https://docs.moodle.org/401/en/Using_web_services#Enable_capabilities
    # List of available functions: https://docs.moodle.org/dev/Web_service_API_functions

    # Implementation of externallib functions in Moodle source codes (for parameters and return values):
    # https://github.com/moodle/moodle/blob/MOODLE_39_STABLE/mod/assign/externallib.php

    :return:
    """
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    # create a Socket.IO server
    sio = socketio.Server(async_mode='threading')

    @sio.event
    def connect(sid, environ, auth):
        logger.info(f"Connection established with {sid}")

    @sio.on("call")
    def call(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        try:
            response = {"success": True, "data": "Hello World!"}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response
        
    @sio.on("test")
    def test(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        try:
            api = Moodle(data['options']['apiKey'], data['options']['url'])
            users = api.create_users_from_course(data['courseID'])
            response = {"success": True, "data": users}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response
        
    @sio.on("getUsersFromCourse")
    def getUsersFromCourse(sid, data):
        try:
            logger.info(f"Received call: {data} from {sid}")
            api = Moodle(data['options']['apiKey'], data['options']['url'])
            users = api.get_users_from_course(data['courseID'])
            response = {"success": True, "data": users}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response
    
    @sio.on("getUsersFromAssignment")
    def getUsersFromAssignment(sid, data):
        try:
            logger.info(f"Received call: {data} from {sid}")
            api = Moodle(data['options']['apiKey'], data['options']['url'])
            users = api.get_users_from_assignment(data['courseID'], data['assignmentID'])
            response = {"success": True, "data": users}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response
    
    @sio.on("getSubmissionInfosFromAssignment")
    def getSubmissionInfosFromAssignment(sid, data):
        try:
            logger.info(f"Received call: {data} from {sid}")
            api = Moodle(data['options']['apiKey'], data['options']['url'])
            submission_infos = api.get_submission_infos_from_assignment(course_id=data['courseID'], assignment_cmid=data['assignmentID'])
            response = {"success": True, "data": submission_infos}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response
        
    @sio.on("downloadSubmissionsFromUser")
    def downloadSubmissionsFromUser(sid, data):
        try:
            logger.info(f"Received call: {data} from {sid}")
            api = Moodle(data['options']['apiKey'], data['options']['url'])
            files = api.download_submissions_from_user(data)
            response = {"success": True, "data": files}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            logger.info(f"Received call: {data} from {sid}")
            response = {"success": False, "message": "error: " + str(e)}
            return response
        
    @sio.on("uploadLoginDataToMoodle")
    def uploadLoginDataToMoodle(sid, data):
        try:
            logger.info(f"Received call: {data} from {sid}")
            api = Moodle(data['options']['apiKey'], data['options']['url'])
            api.upload_login_data_to_moodle(course_id=data['courseID'], assignment_id=data['assignmentID'], login_data=data['loginData'])
            response = {"success": True, "data": "Passwords uploaded successfully."}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response
    
    logger.info("Creating App...")
    app = socketio.WSGIApp(sio)
    return app





    



    
    
   

