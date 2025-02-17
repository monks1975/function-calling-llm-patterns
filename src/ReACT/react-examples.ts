export const REACT_EXAMPLES = `
Here are examples of how to analyze and solve problems step by step:

<user>Calculate how many apples each person gets if we have 125 apples to distribute among 5 people.</user>
<assistant>
{
    "thought": "I need to divide 125 apples by 5 people to find out how many apples each person gets.",
    "action": "calculator",
    "input": "125 / 5"
}
</assistant>
<user>Observation: 25</user>
<assistant>
{
    "thought": "The calculation shows each person would get 25 apples.",
    "final_answer": "Each person would get 25 apples."
}
</assistant>

<user>What is the capital of France and what is its population?</user>
<assistant>
{
    "thought": "I need to first confirm the capital of France and then find its population.",
    "action": "search",
    "input": "capital of France"
}
</assistant>
<user>Observation: Paris is the capital of France</user>
<assistant>
{
    "thought": "Now I need to find Paris's population",
    "action": "search",
    "input": "current population of Paris"
}
</assistant>
<user>Observation: Paris has a population of approximately 2.2 million people (city proper)</user>
<assistant>
{
    "thought": "I have both pieces of information needed to answer the question.",
    "final_answer": "The capital of France is Paris, with a population of approximately 2.2 million people in the city proper."
}
</assistant>

<user>If a product costs $100 and there's a 20% discount followed by a 10% price increase, what's the final price?</user>
<assistant>
{
    "thought": "First, I need to calculate the price after the 20% discount.",
    "action": "calculator",
    "input": "100 * (1 - 0.20)"
}
</assistant>
<user>Observation: 80</user>
<assistant>
{
    "thought": "Now I need to calculate the price after the 10% increase on $80.",
    "action": "calculator",
    "input": "80 * (1 + 0.10)"
}
</assistant>
<user>Observation: 88</user>
<assistant>
{
    "thought": "I have calculated the final price after both the discount and increase.",
    "final_answer": "The final price is $88.00."
}
</assistant>

<user>What ingredients do I need to make a basic chocolate cake?</user>
<assistant>
{
    "thought": "I need to search for a basic chocolate cake recipe.",
    "action": "search",
    "input": "basic chocolate cake ingredients list"
}
</assistant>
<user>Observation: Basic chocolate cake ingredients: flour, sugar, cocoa powder, baking powder, eggs, milk, vegetable oil, vanilla extract</user>
<assistant>
{
    "thought": "I have found a list of common ingredients for a basic chocolate cake.",
    "final_answer": "For a basic chocolate cake, you need: flour, sugar, cocoa powder, baking powder, eggs, milk, vegetable oil, and vanilla extract."
}
</assistant>

<user>What will the weather be like in London next week?</user>
<assistant>
{
    "thought": "I need to check a weather forecast for London.",
    "action": "search",
    "input": "London weather forecast next week"
}
</assistant>
<user>Observation: Error: Cannot predict future weather with current tools</user>
<assistant>
{
    "thought": "I realize I cannot provide accurate future weather information without access to real-time weather data.",
    "final_answer": "I apologize, but I cannot predict the weather for next week in London. You would need to check a current weather forecast service for accurate information."
}
</assistant>

<user>Convert 100 kilometers to miles.</user>
<assistant>
{
    "thought": "I need to multiply kilometers by 0.621371 to convert to miles.",
    "action": "calculator",
    "input": "100 * 0.621371"
}
</assistant>
<user>Observation: 62.1371</user>
<assistant>
{
    "thought": "I have converted 100 kilometers to miles.",
    "final_answer": "100 kilometers is equal to 62.14 miles."
}
</assistant>

<user>What is the square root of 256?</user>
<assistant>
{
    "thought": "I need to calculate the square root of 256.",
    "action": "calculator", 
    "input": "Math.sqrt(256)"
}
</assistant>
<user>Observation: 16</user>
<assistant>
{
    "thought": "I have calculated the square root.",
    "final_answer": "The square root of 256 is 16."
}
</assistant>

<user>Who wrote Romeo and Juliet?</user>
<assistant>
{
    "thought": "This is a well-known historical fact that I know directly.",
    "final_answer": "William Shakespeare wrote Romeo and Juliet."
}
</assistant>

<user>What is the population of Tokyo?</user>
<assistant>
{
    "thought": "I need to search for current population data of Tokyo.",
    "action": "search",
    "input": "Tokyo current population 2024"
}
</assistant>
<user>Observation: Tokyo has a population of approximately 37 million people in its metropolitan area</user>
<assistant>
{
    "thought": "I have found the current population figure for Tokyo's metropolitan area.",
    "final_answer": "Tokyo has a population of approximately 37 million people in its metropolitan area."
}
</assistant>

<user>Calculate 15% of 80.</user>
<assistant>
{
    "thought": "I need to multiply 80 by 0.15 to find 15%.",
    "action": "calculator",
    "input": "80 * 0.15"
}
</assistant>
<user>Observation: 12</user>
<assistant>
{
    "thought": "I have calculated the percentage.",
    "final_answer": "15% of 80 is 12."
}
</assistant>

<user>What is photosynthesis?</user>
<assistant>
{
    "thought": "I should provide a clear, concise explanation of this biological process.",
    "final_answer": "Photosynthesis is the process by which plants convert sunlight, water, and carbon dioxide into glucose and oxygen. This process is essential for plant growth and provides food and oxygen for most life on Earth."
}
</assistant>

<user>How many planets are between Earth and the Sun?</user>
<assistant>
{
    "thought": "I know the order of planets in our solar system.",
    "final_answer": "There are two planets between Earth and the Sun: Mercury and Venus."
}
</assistant>

<user>What's the boiling point of water in Fahrenheit?</user>
<assistant>
{
    "thought": "I need to convert 100°C (water's boiling point) to Fahrenheit.",
    "action": "calculator",
    "input": "(100 * 9/5) + 32"
}
</assistant>
<user>Observation: 212</user>
<assistant>
{
    "thought": "I have converted the temperature.",
    "final_answer": "Water boils at 212 degrees Fahrenheit at standard atmospheric pressure."
}
</assistant>

<user>Who is the current President of France?</user>
<assistant>
{
    "thought": "I should search for the current President of France to ensure accuracy.",
    "action": "search",
    "input": "current President of France 2024"
}
</assistant>
<user>Observation: Emmanuel Macron is the current President of France</user>
<assistant>
{
    "thought": "I have confirmed the current French President.",
    "final_answer": "Emmanuel Macron is the current President of France."
}
</assistant>

<user>What's the area of a circle with radius 5?</user>
<assistant>
{
    "thought": "I need to use the formula πr² where r=5.",
    "action": "calculator",
    "input": "Math.PI * 5 * 5"
}
</assistant>
<user>Observation: 78.53981633974483</user>
<assistant>
{
    "thought": "I have calculated the area and should round for clarity.",
    "final_answer": "The area of a circle with radius 5 is approximately 78.54 square units."
}
</assistant>

<user>What is the chemical symbol for gold?</user>
<assistant>
{
    "thought": "This is a basic chemistry fact that I know.",
    "final_answer": "The chemical symbol for gold is Au."
}
</assistant>


`;
