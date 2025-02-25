// ~/src/ReAct/api.ts
// Simple express ReACT chat REST API

import 'dotenv/config';
import { z } from 'zod';
import cors from 'cors';
import express, { Router, Request, Response } from 'express';

import { ReActAgent } from './react.agent';
import { ReActStream } from './react.stream';

import type { AiConfig } from './ai';

const app = express();
const router = Router();
const port = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Configure AI settings
const ai_config: AiConfig = {
  base_url: 'https://api.cerebras.ai/v1',
  api_key: process.env.CEREBRAS_API_KEY!,
  model: 'llama3.1-8b',
  max_tokens: 8192,
  temperature: 0.2,
};

// Configure tools
const tools_config = {
  calculator: {
    enabled: true,
  },
  search_web: {
    enabled: true,
  },
  library: {
    enabled: true,
    config: {
      library_name: 'Steve Jobs Isaacson Biography Library',
      library_description:
        'A library focused on the biography of Steve Jobs by Walter Isaacson.',
      library_uuid: process.env.DOJO_API_LIBRARY_UUID,
    },
  },
};

// Configure streaming options
const stream_config = {
  stream_thoughts: true,
  stream_actions: true,
};

const askSchema = z.object({
  question: z.string().min(1),
});

router.post('/ask', (req: Request, res: Response) => {
  try {
    const { question } = askSchema.parse(req.body);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create new agent and stream instances for each request
    const agent = new ReActAgent(ai_config, tools_config);
    const stream = new ReActStream(agent, stream_config);

    // Create readable stream from question
    const readable = stream.create_readable_stream(question);

    // Handle stream events
    readable.on('data', (chunk) => {
      res.write(`data: ${chunk}\n\n`);
    });

    readable.on('end', () => {
      agent.cleanup();
      res.end();
    });

    readable.on('error', (error) => {
      console.error('Stream error:', error);
      agent.cleanup();
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      agent.cleanup();
      readable.destroy();
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Mount router
app.use('/api', router);

// Start server
app.listen(port, () => {
  console.log(`ReAct API server listening on port ${port}`);
});
