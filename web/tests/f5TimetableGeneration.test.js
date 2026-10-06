/**
 * F5: TC Timetable Design & Generation UI - Frontend Tests
 * Imports actual production helpers from timetableGenerationService.js
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log("  PASS: " + testName);
  } else {
    failedTests++;
    console.error("  FAIL: " + testName);
  }
}

async function runF5Tests() {
  console.log("====================================================");
  console.log("F5: TC TIMETABLE DESIGN & GENERATION UI TESTS");
  console.log("====================================================");
  console.log("");

  const generationService = await import("../src/services/timetableGenerationService.js");
  const { isGenerationReadyForContext, buildGenerationPayload, normalizeGenerationResponse, buildReviewUrl, buildClassTimetableUrl, buildGenerationErrorMessage } = generationService;

  console.log("");
  console.log("--- 1. isGenerationReadyForContext() ---");
  assert(isGenerationReadyForContext("", true) === false, "empty context -> false");
  assert(isGenerationReadyForContext(null, true) === false, "null context -> false");
  assert(isGenerationReadyForContext(undefined, true) === false, "undefined context -> false");
  assert(isGenerationReadyForContext("ctx_valid", true) === true, "valid context + ready -> true");
  assert(isGenerationReadyForContext("ctx_valid", false) === false, "valid context + not ready -> false");

  console.log("");
  console.log("--- 2. buildGenerationPayload() ---");
  const payload = buildGenerationPayload("ctx_3_a");
  assert(payload.academicContextId === "ctx_3_a", "selected context ctx_3_a returns correct payload");
  assert(typeof payload === "object", "payload is an object");

  console.log("");
  console.log("--- 3. normalizeGenerationResponse() ---");
  const mockResponse = { data: { timetableVersion: { _id: "ver_001", versionLabel: "v1.0" }, sessionsCreated: 28, assignments: new Array(28).fill({}) } };
  const summary = normalizeGenerationResponse(mockResponse, "III Year", "Semester V", "A", { totalRequiredCourses: 6 }, { theoryCount: 3, labCount: 1 }, "ctx_3_a");
  assert(summary.versionId === "ver_001", "versionId preserved");
  assert(summary.versionLabel === "v1.0", "versionLabel preserved");
  assert(summary.sessionsCreated === 28, "sessionsCreated preserved");
  assert(summary.totalCourses === 6, "totalCourses preserved");
  assert(summary.academicContextId === "ctx_3_a", "academicContextId equals active context ctx_3_a");

  console.log("");
  console.log("--- 4. buildGenerationErrorMessage() ---");
  const msg400 = buildGenerationErrorMessage({ status: 400, message: "Invalid cohort configuration" });
  assert(msg400.includes("Bad Request") || msg400.includes("Invalid"), "400 mapped to validation guidance");
  const msg401 = buildGenerationErrorMessage({ status: 401, message: "Token expired" });
  assert(msg401.includes("Unauthorized") || msg401.includes("expired") || msg401.includes("session"), "401 indicates session issue");
  const msg403 = buildGenerationErrorMessage({ status: 403, message: "Insufficient permissions" });
  assert(msg403.includes("Forbidden") || msg403.includes("permission"), "403 indicates authorization failure");
  const msg409 = buildGenerationErrorMessage({ status: 409, message: "Timetable already exists" });
  assert(msg409.includes("Conflict") || msg409.includes("already exists"), "409 indicates conflict");
  const msg500 = buildGenerationErrorMessage({ status: 500, message: "Internal server error" });
  assert(msg500.includes("Server Error") || msg500.includes("failed") || msg500.includes("error"), "500 indicates backend failure");

  // Network error test (requirement 3)
  const msgNetwork = buildGenerationErrorMessage({ code: 'NETWORK_ERROR' });
  assert(msgNetwork.includes("Network Error"), "network error mapped to Network Error message");

  console.log("");
  console.log("--- 5. buildReviewUrl() ---");
  const reviewUrl = buildReviewUrl("ctx_3_a", "ver_001");
  assert(reviewUrl.includes("academicContextId=ctx_3_a"), "reviewUrl includes academicContextId");
  assert(reviewUrl.includes("versionId=ver_001"), "reviewUrl includes versionId");

  console.log("");
  console.log("--- 6. buildClassTimetableUrl() ---");
  const classUrl = buildClassTimetableUrl("ctx_3_a");
  assert(classUrl.includes("academicContextId=ctx_3_a"), "classUrl includes academicContextId");

  console.log("");
  console.log("--- 7. Multi-Faculty LAB (production timetableService) ---");
  const timetableService = await import("../src/services/timetableService.js");
  const { getSessionFacultyList } = timetableService;
  const labSession = { day: "TUE", period: "P5", courseCode: "22CSP09", facultyAssignments: [{ facultyId: "FWL-01", role: "PRIMARY" }, { facultyId: "FWL-02", role: "ADDITIONAL" }] };
  const facultyList = getSessionFacultyList(labSession);
  assert(Array.isArray(facultyList), "getSessionFacultyList returns an array");
  assert(facultyList.length === 2, "getSessionFacultyList preserves 2 faculty assignments for multi-faculty LAB");
  assert(facultyList[0].facultyId === "FWL-01" && facultyList[0].role === "PRIMARY", "first assignment is PRIMARY FWL-01");
  assert(facultyList[1].facultyId === "FWL-02" && facultyList[1].role === "ADDITIONAL", "second assignment is ADDITIONAL FWL-02");

  console.log("");
  console.log("====================================================");
  console.log("F5 TEST SUMMARY: " + passedTests + "/" + totalTests + " Passed (" + failedTests + " Failed)");
  console.log("====================================================");
  console.log("");
  if (failedTests > 0) process.exit(1);
}

runF5Tests().catch(function(err) { console.error("[F5 Test Fatal Error]", err); process.exit(1); });