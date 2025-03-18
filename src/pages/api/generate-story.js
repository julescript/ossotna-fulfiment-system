// API endpoint for generating stories using OpenAI Assistant
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { assistantId, content } = req.body;

    if (!assistantId) {
      return res.status(400).json({ error: 'Missing assistantId parameter' });
    }

    if (!content) {
      return res.status(400).json({ error: 'Missing content parameter' });
    }

    // Initialize OpenAI client
    const { OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a thread
    const thread = await openai.beta.threads.create();

    // Add a message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: content,
    });

    // Run the assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    // Poll for the run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    // Wait for the run to complete (with timeout)
    const startTime = Date.now();
    const timeout = 60000; // 60 seconds timeout
    
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed') {
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > timeout) {
        return res.status(504).json({ error: 'Request timed out' });
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check the status again
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    if (runStatus.status === 'failed') {
      return res.status(500).json({ error: 'Assistant run failed', details: runStatus });
    }

    // Get the messages from the thread
    const messages = await openai.beta.threads.messages.list(thread.id);

    // Find the assistant's response (should be the latest message)
    const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
    
    if (assistantMessages.length === 0) {
      return res.status(404).json({ error: 'No response from assistant' });
    }

    // Get the latest assistant message
    const latestMessage = assistantMessages[0];
    
    // Extract the text content
    let story = '';
    if (latestMessage.content && latestMessage.content.length > 0) {
      for (const contentPart of latestMessage.content) {
        if (contentPart.type === 'text') {
          story += contentPart.text.value;
        }
      }
    }
    
    // Remove backticks at beginning and end of the response
    story = story.replace(/^```(typescript|ts)?\n?/, '');
    story = story.replace(/\n?```$/, '');

    return res.status(200).json({ story });
  } catch (error) {
    console.error('Error generating story:', error);
    return res.status(500).json({ error: 'Failed to generate story', details: error.message });
  }
}
