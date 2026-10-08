/**
 * F5: TC Timetable Generation Service
 * Pure production helpers for generation workflow
 */

/**
 * Check if generation is ready given context and readiness flag
 */
export function isGenerationReadyForContext(activeContextId, isGenerationReady) {
  if (!activeContextId) return false;
  return Boolean(isGenerationReady);
}

/**
 * Build generation request payload
 */
export function buildGenerationPayload(academicContextId) {
  return { academicContextId };
}

/**
 * Normalize generation response into summary object
 */
export function normalizeGenerationResponse(response, selectedYear, targetCurriculumSemester, selectedSection, cohortValidation, planStatus, activeContextId) {
  const data = response?.data || response;
  const version = data.timetableVersion || data.version || {};
  const sessionsCreated = data.sessionsCreated ?? (data.assignments?.length || 0);
  return {
    status: "GENERATED",
    versionId: version._id || version.id || "",
    versionLabel: version.versionLabel || "v1.0",
    academicContextId: activeContextId,
    academicContext: selectedYear + " | " + targetCurriculumSemester + " | Section " + selectedSection,
    totalCourses: cohortValidation?.totalRequiredCourses || planStatus.totalCourses,
    theoryCourses: planStatus.theoryCount,
    labCourses: planStatus.labCount,
    allocatedCourses: cohortValidation?.allocatedCount || planStatus.allocatedCount,
    sessionsCreated,
    timestamp: new Date().toLocaleTimeString(),
  };
}

/**
 * Build review matrix URL
 */
export function buildReviewUrl(academicContextId, versionId) {
  let url = "/coordinator/view?academicContextId=" + encodeURIComponent(academicContextId);
  if (versionId) url += "&versionId=" + encodeURIComponent(versionId);
  return url;
}

/**
 * Build class timetable URL
 */
export function buildClassTimetableUrl(academicContextId) {
  return "/faculty/class-timetable?academicContextId=" + encodeURIComponent(academicContextId);
}

/**
 * Build human-readable error detail from HTTP status + backend payload
 * Uses existing describeError for normalization, with explicit status mapping.
 */
export function buildGenerationErrorMessage(err) {
  const status = err?.status || err?.response?.status || 0;
  const backendMsg = err?.data?.message || err?.message || '';

  switch (status) {
    case 400:
      return `Bad Request — ${backendMsg || 'The generation request is invalid. Check course-faculty assignments and retry.'}`;
    case 401:
      return 'Unauthorized — your session may have expired. Please log in again and retry.';
    case 403:
      return 'Forbidden — you do not have permission to generate a timetable for this cohort.';
    case 409:
      return `Conflict — ${backendMsg || 'A timetable already exists for this academic context.'}`;
    case 500:
      return `Server Error — ${backendMsg || 'The backend failed to generate the timetable. Please try again later.'}`;
    default:
      if (status === 0 || err?.code === 'NETWORK_ERROR') {
        return 'Network Error — unable to reach the backend. Verify the server is running and retry.';
      }
      // For other HTTP status codes, use the existing describeError for normalization
      return backendMsg || `HTTP Error ${status}`;
  }
}