// ~/src/ReWOO/planner.examples.ts

import type { ReWooPlanExample } from './types';

export const examples: ReWooPlanExample[] = [
  /*
   * LLM Tools
   * Examples demonstrating usage with only the default LLM tool
   */

  {
    task: 'What are the three laws of motion?',
    required_tools: ['LLM'],
    plan_steps: [
      "List and explain Newton's three laws. #E1 = LLM[Explain Newton's three laws of motion]",
    ],
  },
  {
    task: 'Who wrote Romeo and Juliet?',
    required_tools: ['LLM'],
    plan_steps: [
      'Provide basic Shakespeare facts. #E1 = LLM[State when Shakespeare wrote Romeo and Juliet]',
    ],
  },
  {
    task: 'Explain how photosynthesis works',
    required_tools: ['LLM'],
    plan_steps: [
      'Provide basic explanation of photosynthesis process. #E1 = LLM[Explain the core steps of photosynthesis]',
      'Add details about cellular components involved. #E2 = LLM[Expand on cellular structures mentioned in (#E1)]',
    ],
  },
  {
    task: 'How does the water cycle work?',
    required_tools: ['LLM'],
    plan_steps: [
      'Explain main water cycle stages. #E1 = LLM[List the main stages of the water cycle]',
      'Provide details about each stage. #E2 = LLM[Elaborate on each stage from (#E1)]',
    ],
  },
  {
    task: 'Evaluate effective teaching methods for different learning styles',
    required_tools: ['LLM'],
    plan_steps: [
      'Identify learning styles. #E1 = LLM[List and describe the main learning styles and their characteristics]',
      'Analyze teaching methods. #E2 = LLM[Describe evidence-based teaching methods for different learning styles from (#E1)]',
      'Evaluate effectiveness. #E3 = LLM[Analyze the effectiveness of different teaching methods for each learning style]',
      'Generate recommendations. #E4 = LLM[Create specific teaching recommendations based on analysis in (#E2) and (#E3)]',
      'Create implementation guide. #E5 = LLM[Develop practical implementation steps for recommendations in (#E4)]',
    ],
  },

  /*
   * Calculator Tool
   * Examples demonstrating usage of calculator tool
   */

  {
    task: 'What is 2 + 2?',
    required_tools: ['Calculator'],
    plan_steps: ['Calculate the sum of 2 and 2. #E1 = Calculator[2 + 2]'],
  },

  {
    task: 'Calculate the area of a circle with radius 5',
    required_tools: ['Calculator'],
    plan_steps: ['Calculate area using pi*r^2. #E1 = Calculator[pi * 5 ^ 2]'],
  },
  {
    task: 'What is the compound interest on $1000 invested at 5% APR for 3 years?',
    required_tools: ['Calculator', 'LLM'],
    plan_steps: [
      'Calculate compound interest. #E1 = Calculator[1000 * (1 + 0.05) ^ 3 - 1000]',
      'Explain the calculation. #E2 = LLM[Explain how compound interest of (#E1) was calculated]',
    ],
  },
  {
    task: 'Calculate mortgage payments based on current rates',
    required_tools: ['Calculator', 'Tavily', 'LLM'],
    plan_steps: [
      'Get current rate data. #E1 = Tavily[current average 30 year fixed mortgage rate]',
      'Extract rate value. #E2 = LLM[Extract just the interest rate as a decimal number from (#E1)]',
      'Calculate payment. #E3 = Calculator[300000 * (#E2/12 * (1 + #E2/12) ^ 360) / ((1 + #E2/12) ^ 360 - 1)]',
      'Analyze payment. #E4 = LLM[Explain monthly payment (#E3) in context of current rate (#E1)]',
    ],
  },

  {
    task: 'Calculate the area and perimeter of a rectangle with length 8 and width 5',
    required_tools: ['Calculator'],
    plan_steps: [
      'Calculate area. #E1 = Calculator[8 * 5]',
      'Calculate perimeter. #E2 = Calculator[2 * (8 + 5)]',
      'Calculate diagonal. #E3 = Calculator[sqrt(8^2 + 5^2)]',
    ],
  },

  {
    task: 'Analyze investment portfolio with compound interest and inflation adjustment',
    required_tools: ['Calculator', 'LLM'],
    plan_steps: [
      'Calculate initial growth. #E1 = Calculator[10000 * (1 + 0.07)^10]',
      'Calculate inflation impact. #E2 = Calculator[#E1 / (1 + 0.03)^10]',
      'Calculate real return percentage. #E3 = Calculator[(#E2 / 10000 - 1) * 100]',
      'Calculate alternative investment. #E4 = Calculator[10000 * (1 + 0.09)^10 / (1 + 0.03)^10]',
      'Calculate difference. #E5 = Calculator[#E4 - #E2]',
      'Analyze results. #E6 = LLM[Compare investment outcomes using nominal value (#E1), inflation-adjusted value (#E2), real return (#E3), and alternative strategy difference (#E5)]',
    ],
  },

  {
    task: 'Compare portfolio returns to market benchmarks',
    required_tools: ['Calculator', 'Tavily', 'MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Get portfolio data. #E1 = MemoryByKeyword[investment portfolio returns]',
      'Extract portfolio return. #E2 = LLM[Extract return percentage as decimal number from (#E1)]',
      'Get market data. #E3 = Tavily[S&P 500 YTD return percentage]',
      'Extract market return. #E4 = LLM[Extract S&P return percentage as decimal number from (#E3)]',
      'Calculate difference. #E5 = Calculator[#E2 - #E4]',
      'Generate analysis. #E6 = LLM[Analyze portfolio vs market performance using calculated difference (#E5)]',
    ],
  },

  /*
   * Web Search Tools
   * Examples demonstrating usage of web search tool Tavily
   */

  {
    task: 'What is the capital of France?',
    required_tools: ['Tavily', 'LLM'],
    plan_steps: [
      'Search for basic facts. #E1 = Tavily[capital of France facts]',
    ],
  },
  {
    task: 'What is the population of Tokyo?',
    required_tools: ['Tavily'],
    plan_steps: [
      'Search for current population data. #E1 = Tavily[Tokyo current population statistics]',
      'Analyze findings for key trends. #E2 = LLM[Analyze (#E1) to identify major trends and impacts]',
    ],
  },
  {
    task: 'When was the Declaration of Independence signed?',
    required_tools: ['Tavily'],
    plan_steps: [
      'Search for historical date. #E1 = Tavily[When was US Declaration of Independence signed]',
    ],
  },
  {
    task: 'How has artificial intelligence impacted healthcare in the last 5 years?',
    required_tools: ['Tavily', 'LLM'],
    plan_steps: [
      'Search for recent AI healthcare innovations. #E1 = Tavily[artificial intelligence healthcare developments 2019-2024]',
      'Search for impact statistics. #E2 = Tavily[statistics AI healthcare improvements outcomes 2019-2024]',
      'Search for challenges and limitations. #E3 = Tavily[AI healthcare challenges ethical concerns limitations]',
      'Analyze findings for key trends. #E4 = LLM[Analyze (#E1) (#E2) (#E3) to identify major trends and impacts]',
      'Create comprehensive summary. #E5 = LLM[Create structured overview from (#E4) highlighting benefits and challenges]',
    ],
  },
  {
    task: 'What are the environmental and economic impacts of renewable energy adoption?',
    required_tools: ['Tavily', 'LLM'],
    plan_steps: [
      'Search for environmental impact data. #E1 = Tavily[renewable energy environmental impact statistics 2024]',
      'Search for economic effects. #E2 = Tavily[renewable energy economic impact job creation costs]',
      'Search for adoption challenges. #E3 = Tavily[renewable energy implementation challenges infrastructure costs]',
      'Analyze environmental aspects. #E4 = LLM[Analyze environmental impacts from (#E1)]',
      'Create comprehensive assessment. #E5 = LLM[Synthesize (#E2) (#E3) (#E4) into balanced analysis of impacts]',
    ],
  },

  /*
   * Memory Tools
   * Examples demonstrating usage of memory-related tools RecentMemory and MemoryByKeyword
   */

  {
    task: 'What have I asked about renewable energy?',
    required_tools: ['MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Search memory for energy topics. #E1 = MemoryByKeyword[renewable energy, solar, wind power]',
      'Create structured summary. #E2 = LLM[Organize key points from (#E1)]',
    ],
  },
  {
    task: 'Show me our recent discussions about machine learning',
    required_tools: ['RecentMemory', 'LLM'],
    plan_steps: [
      'Get recent ML conversations. #E1 = RecentMemory[{"from_date": "2024-01-01"}]',
      'Extract key insights. #E2 = LLM[Summarize machine learning topics from (#E1)]',
    ],
  },
  {
    task: 'What have we covered about quantum computing and AI?',
    required_tools: ['MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Search quantum computing discussions. #E1 = MemoryByKeyword[quantum computing, qubits]',
      'Search AI discussions. #E2 = MemoryByKeyword[artificial intelligence, AI, machine learning]',
      'Create comprehensive overview. #E3 = LLM[Synthesize connections between (#E1) and (#E2)]',
    ],
  },
  {
    task: 'What questions did I ask last month about blockchain?',
    required_tools: ['RecentMemory', 'MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Get recent blockchain memories. #E1 = RecentMemory[{"from_date": "2024-02-01", "to_date": "2024-02-29"}]',
      'Search for related crypto topics. #E2 = MemoryByKeyword[cryptocurrency, NFT, web3]',
      'Create timeline summary. #E3 = LLM[Create chronological overview from (#E1) and (#E2)]',
    ],
  },
  {
    task: 'How has my understanding of deep learning evolved?',
    required_tools: ['RecentMemory', 'MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Get historical deep learning queries. #E1 = MemoryByKeyword[deep learning, neural networks]',
      'Get recent discussions. #E2 = RecentMemory[{"limit": 5}]',
      'Analyze learning progression. #E3 = LLM[Compare early vs recent understanding from (#E1) and (#E2)]',
      'Create learning roadmap. #E4 = LLM[Build progression timeline and identify knowledge gaps from (#E3)]',
    ],
  },
  {
    task: 'What topics in physics have we discussed?',
    required_tools: ['MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Search quantum physics topics. #E1 = MemoryByKeyword[quantum mechanics, particle physics]',
      'Search classical physics topics. #E2 = MemoryByKeyword[classical mechanics, relativity]',
      'Search applied physics topics. #E3 = MemoryByKeyword[thermodynamics, optics, electromagnetism]',
      'Create subject overview. #E4 = LLM[Create categorized summary from (#E1) (#E2) (#E3)]',
    ],
  },
  {
    task: 'What programming languages have I asked about recently?',
    required_tools: ['RecentMemory', 'MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Get recent coding discussions. #E1 = RecentMemory[{"limit": 10}]',
      'Search specific languages. #E2 = MemoryByKeyword[Python, JavaScript, TypeScript, Rust]',
      'Analyze programming interests. #E3 = LLM[Extract and categorize programming topics from (#E1) and (#E2)]',
    ],
  },
  {
    task: 'How have my interests in technology changed this year?',
    required_tools: ['RecentMemory', 'MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Get early 2024 discussions. #E1 = RecentMemory[{"from_date": "2024-01-01", "to_date": "2024-01-31"}]',
      'Get current interests. #E2 = RecentMemory[{"limit": 15}]',
      'Search tech categories. #E3 = MemoryByKeyword[AI, blockchain, IoT, cybersecurity]',
      'Analyze interest evolution. #E4 = LLM[Compare interest changes using (#E1) (#E2) (#E3)]',
      'Create trend analysis. #E5 = LLM[Build visual timeline of interest evolution from (#E4)]',
    ],
  },
  {
    task: 'What environmental topics have we covered?',
    required_tools: ['MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Search climate topics. #E1 = MemoryByKeyword[climate change, global warming]',
      'Search conservation topics. #E2 = MemoryByKeyword[biodiversity, conservation, ecosystems]',
      'Search sustainability topics. #E3 = MemoryByKeyword[renewable energy, recycling, sustainable]',
      'Create environmental report. #E4 = LLM[Create comprehensive environmental topic analysis from (#E1) (#E2) (#E3)]',
    ],
  },
  {
    task: 'What have been my main areas of learning?',
    required_tools: ['RecentMemory', 'MemoryByKeyword', 'LLM'],
    plan_steps: [
      'Get recent learning history. #E1 = RecentMemory[{"limit": 20}]',
      'Search tech learning. #E2 = MemoryByKeyword[programming, AI, data science]',
      'Search science learning. #E3 = MemoryByKeyword[physics, biology, chemistry]',
      'Analyze learning patterns. #E4 = LLM[Identify main knowledge domains from (#E1) (#E2) (#E3)]',
      'Create learning profile. #E5 = LLM[Build comprehensive learning profile and suggest growth areas from (#E4)]',
    ],
  },

  /*
   * Library Tools
   * Examples demonstrating usage of library tool
   */

  {
    task: 'Find information about photosynthesis',
    required_tools: ['Library'],
    plan_steps: [
      'Search basic photosynthesis info. #E1 = Library[photosynthesis process overview]',
    ],
  },
  {
    task: 'Explain the differences between classical and quantum mechanics',
    required_tools: ['Library', 'LLM'],
    plan_steps: [
      'Get core concepts. #E1 = Library["classical mechanics" OR "quantum mechanics" comparison fundamentals]',
      'Create explanation. #E2 = LLM[Create clear comparison explanation from (#E1)]',
    ],
  },
  {
    task: 'Research the history and impact of the industrial revolution',
    required_tools: ['Library', 'LLM'],
    plan_steps: [
      'Get historical overview. #E1 = Library["industrial revolution" history overview]',
      'Get impact analysis. #E2 = Library["industrial revolution" social OR economic OR environmental impact]',
      'Create synthesis. #E3 = LLM[Create comprehensive analysis combining historical data (#E1) with impact assessment (#E2)]',
    ],
  },
  {
    task: 'Research advances in renewable energy technology',
    required_tools: ['Library', 'LLM'],
    plan_steps: [
      'Get historical context. #E1 = Library["renewable energy" history development]',
      'Get current research. #E2 = Library["renewable energy" latest advances OR breakthroughs 2024]',
      'Get efficiency data. #E3 = Library["renewable energy" efficiency comparison statistics]',
      'Get future outlook. #E4 = Library["renewable energy" future predictions OR forecasts]',
      'Create analysis. #E5 = LLM[Create comprehensive analysis of renewable energy progress using (#E1) (#E2) (#E3) (#E4)]',
    ],
  },
  {
    task: 'Research the evolution of artificial intelligence',
    required_tools: ['Library', 'LLM'],
    plan_steps: [
      'Get early history. #E1 = Library["artificial intelligence" early history 1950-1990]',
      'Get modern developments. #E2 = Library["artificial intelligence" development 1990-2020]',
      'Get current state. #E3 = Library["artificial intelligence" current state 2020-2024]',
      'Get impact analysis. #E4 = Library["artificial intelligence" impact society OR economy]',
      'Get future predictions. #E5 = Library["artificial intelligence" future trends OR predictions]',
      'Create timeline. #E6 = LLM[Create comprehensive AI evolution timeline and analysis using (#E1) (#E2) (#E3) (#E4) (#E5)]',
    ],
  },

  /*
   * Complex, multi-tool examples
   * Examples demonstrating usage of multiple tools together
   */

  {
    task: 'Analyze recent technological trends and their market impact',
    required_tools: ['RecentMemory', 'Library', 'LLM', 'Tavily'],
    plan_steps: [
      'Get historical context. #E1 = RecentMemory[{"limit": 10}]',
      'Get market data. #E2 = Library["technology trends" recent market analysis]',
      'Verify trends. #E3 = Tavily[latest technology market trends]',
      'Get adoption stats. #E4 = Library["emerging technology" adoption statistics]',
      'Create analysis. #E5 = LLM[Analyze tech trends and market impact using historical context (#E1), market data (#E2), verified trends (#E3), and adoption metrics (#E4)]',
    ],
  },
  {
    task: 'Research and summarize latest developments in quantum computing',
    required_tools: ['Library', 'LLM', 'RecentMemory', 'Tavily'],
    plan_steps: [
      'Get previous research. #E1 = RecentMemory[{"limit": 15}]',
      'Get quantum basics. #E2 = Library["quantum computing" fundamentals explanation]',
      'Get recent advances. #E3 = Library["quantum computing" recent breakthroughs]',
      'Verify breakthroughs. #E4 = Tavily[latest quantum computing breakthroughs]',
      'Get applications. #E5 = Library["quantum computing" practical applications]',
      'Create summary. #E6 = LLM[Create comprehensive quantum computing summary incorporating previous research (#E1), fundamentals (#E2), verified advances (#E3, #E4), and applications (#E5)]',
    ],
  },
  {
    task: 'Analyze climate change impacts and mitigation strategies',
    required_tools: ['Library', 'LLM', 'RecentMemory', 'Tavily'],
    plan_steps: [
      'Get historical data. #E1 = Library["climate change" historical data trends]',
      'Get recent studies. #E2 = RecentMemory[{"limit": 5}]',
      'Get current impacts. #E3 = Tavily[latest climate change impacts and evidence]',
      'Get solutions. #E4 = Library["climate change" mitigation strategies]',
      'Get effectiveness. #E5 = Library["climate change" solution effectiveness data]',
      'Create report. #E6 = LLM[Create comprehensive climate analysis using historical data (#E1), recent studies (#E2), current impacts (#E3), and solution analysis (#E4, #E5)]',
    ],
  },
  {
    task: 'Research the best treatment options for migraines',
    required_tools: ['Library', 'Tavily', 'LLM'],
    plan_steps: [
      'Search for medical information. #E1 = Library["migraine treatment" clinical guidelines]',
      'Verify with latest research. #E2 = Tavily[latest migraine treatment research clinical trials]',
      'Check for contradictions. #E3 = LLM[Identify any contradictions between (#E1) and (#E2)]',
      'Get additional evidence. #E4 = Tavily[Resolve any contradictions identified in (#E3)]',
      'Create treatment overview. #E5 = LLM[Create comprehensive, evidence-based treatment overview reconciling (#E1), (#E2), and if needed (#E4)]',
    ],
  },
  {
    task: 'Analyze cybersecurity threats and defense strategies',
    required_tools: ['Library', 'RecentMemory', 'LLM', 'Tavily'],
    plan_steps: [
      'Get threat landscape. #E1 = Library["cybersecurity threats" current landscape]',
      'Get recent attacks. #E2 = Tavily[major recent cybersecurity attacks and breaches]',
      'Get incident history. #E3 = RecentMemory[{"limit": 20}]',
      'Get defense methods. #E4 = Library["cybersecurity" defense strategies best practices]',
      'Get emerging threats. #E5 = Library["cybersecurity threats" emerging trends predictions]',
      'Create framework. #E6 = LLM[Develop comprehensive cybersecurity framework using threat landscape (#E1), recent attacks (#E2), incident history (#E3), defense strategies (#E4), and emerging threats (#E5)]',
    ],
  },
];
