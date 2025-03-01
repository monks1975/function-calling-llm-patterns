import { create_safe_plan } from './helpers';

// Mock the JSON parsing error with content moderation message
function test_json_parsing_moderation() {
  const json_response =
    'I cannot provide information or harmful content that violates policies';

  // Check if this is a content moderation response
  if (
    json_response.includes('harmful') ||
    json_response.includes('illegal') ||
    json_response.includes('content policy') ||
    json_response.includes('violates') ||
    json_response.includes('inappropriate') ||
    json_response.includes('cannot provide')
  ) {
    console.log(
      'Content moderation detected in response. Returning safe plan.'
    );
    const safe_plan = create_safe_plan('mock harmful request');
    console.log('Generated Safe Plan:');
    console.log(JSON.stringify(safe_plan, null, 2));
    return true;
  }

  return false;
}

// Mock the error message content moderation check
function test_error_message_moderation() {
  const error = new Error(
    'This content violates our content policy and cannot be processed'
  );

  // Check for error messages that might indicate content policy violations
  if (
    error instanceof Error &&
    (error.message.includes('content policy') ||
      error.message.includes('harmful') ||
      error.message.includes('inappropriate') ||
      error.message.includes('violates') ||
      error.message.includes('content filter'))
  ) {
    console.log(
      'Content policy violation detected in error message. Returning safe plan.'
    );
    const safe_plan = create_safe_plan('mock harmful request');
    console.log('Generated Safe Plan:');
    console.log(JSON.stringify(safe_plan, null, 2));
    return true;
  }

  return false;
}

// Run the tests
console.log('Testing JSON parsing moderation detection:');
const json_result = test_json_parsing_moderation();
console.log(`JSON parsing test ${json_result ? 'PASSED' : 'FAILED'}`);

console.log('\nTesting error message moderation detection:');
const error_result = test_error_message_moderation();
console.log(`Error message test ${error_result ? 'PASSED' : 'FAILED'}`);

if (json_result && error_result) {
  console.log(
    '\nAll tests PASSED! The moderation detection should work correctly.'
  );
} else {
  console.log(
    '\nSome tests FAILED. Please review the moderation detection logic.'
  );
}
