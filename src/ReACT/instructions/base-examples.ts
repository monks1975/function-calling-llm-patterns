// ~/src/REACT-COT/instructions/base-examples.ts

export const base_examples = [
  // Example 1: Simple direct knowledge
  'User: What is the capital of France?\n' +
    'Thought: I know this information directly.\n' +
    'Final Answer: The capital of France is Paris.\n' +
    '<HALT>',

  // Example 2: Basic arithmetic
  'User: If John has 3 apples and gives 2 to Mary, how many does he have left?\n' +
    'Thought: Let me break this down:\n' +
    '1. Initial amount: 3 apples\n' +
    '2. Given away: 2 apples\n' +
    '3. Need to subtract\n' +
    'Final Answer: John has 1 apple left.\n' +
    '<HALT>',

  // Example 3: Clarification needed
  "User: What's the largest animal?\n" +
    "Thought: This question needs clarification. I should specify whether we're talking about current living animals or including extinct ones, and whether we're measuring by weight, length, or volume.\n" +
    'Final Answer: The blue whale is the largest animal currently living, measuring up to 100 feet long and weighing up to 200 tons. If we include extinct animals, some dinosaurs like Argentinosaurus were longer, but the blue whale remains the heaviest animal known to have existed.\n' +
    '<HALT>',

  // Example 4: Self-correction
  "User: What's 15 + 27?\n" +
    'Thought: Let me add these numbers.\n' +
    "Thought: I initially got 32, but that's wrong. Let me recalculate.\n" +
    'Thought: 15 + 27 = 42\n' +
    'Final Answer: The sum of 15 and 27 is 42.\n' +
    '<HALT>',

  // Example 5: Step-by-step calculation
  'User: How many seconds are in a year?\n' +
    'Thought: Let me break this down step by step:\n' +
    '1. Hours in a day: 24\n' +
    '2. Minutes in a day: 24 × 60 = 1,440\n' +
    '3. Seconds in a day: 1,440 × 60 = 86,400\n' +
    '4. Days in a year: 365\n' +
    '5. Final calculation: 86,400 × 365\n' +
    'Final Answer: There are 31,536,000 seconds in a regular year (excluding leap years).\n' +
    '<HALT>',

  // Example 6: Process explanation
  'User: Why do leaves change color in fall?\n' +
    'Thought: I should explain both the process and the reason:\n' +
    '1. During summer, leaves contain chlorophyll (green)\n' +
    '2. They also contain carotenoids (yellow/orange)\n' +
    '3. In fall, chlorophyll breaks down\n' +
    '4. This reveals the carotenoids\n' +
    'Final Answer: Leaves change color in fall because they stop producing chlorophyll, the pigment that makes them green. This reveals other pigments (carotenoids) that were always present but hidden by the chlorophyll. This process is triggered by shorter days and cooler temperatures.\n' +
    '<HALT>',

  // Example 7: Future uncertainty
  'User: Who will win the next World Cup?\n' +
    'Thought: This is a future event that cannot be predicted with certainty.\n' +
    "Final Answer: I cannot predict who will win the next World Cup as it's a future event. Any prediction would be speculation. Instead, I can discuss current team rankings and past performance if you're interested.\n" +
    '<HALT>',

  // Example 8: Structured explanation
  'User: What is DNA?\n' +
    'Thought: I should provide a clear, comprehensive explanation that includes:\n' +
    '1. What DNA stands for\n' +
    '2. Its basic function\n' +
    '3. Its structure\n' +
    'Final Answer: DNA (Deoxyribonucleic Acid) is the genetic material present in all living organisms. It\'s a complex molecule that carries the instructions needed to build and maintain an organism. DNA has a double helix structure, like a twisted ladder, where the "rungs" are made of paired chemical bases (A-T and G-C).\n' +
    '<HALT>',

  // Example 9: Misconception correction
  'User: Is the Great Wall of China visible from space?\n' +
    'Thought: This is a common misconception that I should address carefully.\n' +
    "Final Answer: Contrary to popular belief, the Great Wall of China is not visible from space with the naked eye. While it can be seen from low Earth orbit under perfect conditions, it's not visible from the Moon or deep space. Many other human-made structures, like airports and reservoirs, are actually more visible from space.\n" +
    '<HALT>',

  // Example 10: Scientific process explanation
  'User: What makes a rainbow appear?\n' +
    'Thought: I need to explain both the conditions and the process:\n' +
    '1. Required conditions: sunlight and water droplets\n' +
    '2. Process: light refraction and reflection\n' +
    '3. Color separation phenomenon\n' +
    'Final Answer: Rainbows appear when sunlight hits water droplets in the air at just the right angle. The light is first refracted (bent) as it enters the droplet, then reflected off the back of the droplet, and finally refracted again as it exits. This process separates the white light into its component colors (red, orange, yellow, green, blue, indigo, and violet) due to different wavelengths being bent by different amounts.\n' +
    '<HALT>',
];
