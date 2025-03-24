import { CalculatorTool } from '../tools/calculator.tool';

async function test_calculator_plan() {
  const calculator = new CalculatorTool();

  // Simulate the values from the log file
  const e2 = '18292.5'; // User's age in days
  const e3 = 'The Meldrew Point is 19,537 days.'; // LLM output with text

  console.log('Testing the exact scenario from the log file:');
  console.log(`E2 (User's age in days): ${e2}`);
  console.log(`E3 (LLM output): ${e3}`);

  // Test individual extraction
  console.log('\nTesting extraction of E3:');
  const e3_result = await calculator.execute(e3);
  console.log(`Result: ${e3_result}`);

  // Test the calculation that failed in the log
  console.log('\nTesting the calculation that failed (E2 - E3):');
  const calculation = `${e2} - ${e3}`;
  console.log(`Expression: ${calculation}`);
  const result = await calculator.execute(calculation);
  console.log(`Result: ${result}`);

  // Test with variables directly
  console.log('\nTesting with variable substitution:');
  const with_vars = '#E2 - #E3';
  console.log(`Expression with variables: ${with_vars}`);

  // Simulate variable substitution (as would happen in the ReWOO system)
  const substituted = with_vars.replace('#E2', e2).replace('#E3', e3);
  console.log(`After substitution: ${substituted}`);
  const var_result = await calculator.execute(substituted);
  console.log(`Result: ${var_result}`);
}

test_calculator_plan().catch(console.error);
