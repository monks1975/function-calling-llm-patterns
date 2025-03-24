import { CalculatorTool } from '../tools/calculator.tool';

async function test_calculator_examples() {
  const calculator = new CalculatorTool();

  // Test the specific example from the original request
  const example = '20000 - The Meldrew Point is 19,537 days';
  console.log(`Testing original example: "${example}"`);
  const result = await calculator.execute(example);
  console.log(`Result: ${result}`);

  // Test additional examples
  const examples = [
    // Subtraction with text
    'Calculate 50000 - The user is 45,678 days old',
    // Addition with text
    'Add 100 + The price is 250 dollars',
    // Multiplication with text
    'Multiply 5 * The quantity is 10 units',
    // Division with text
    'Divide 1000 / The rate is 20 per hour',
    // Complex expression with text
    '(5000 + The base salary is 3000) * The multiplier is 1.5',
  ];

  for (const example of examples) {
    console.log(`\nTesting: "${example}"`);
    try {
      const result = await calculator.execute(example);
      console.log(`Result: ${result}`);
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }
}

test_calculator_examples().catch(console.error);
