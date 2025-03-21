const { v4: uuidv4 } = require('uuid');

function generateJitsiMeetingLink() {
    const meetingId = uuidv4(); // Generate a unique ID
    const jitsiLink = `https://meet.jit.si/${meetingId}`;
    return jitsiLink;
}

module.exports = { generateJitsiMeetingLink };