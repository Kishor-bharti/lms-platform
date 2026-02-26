import { Request, Response } from 'express';
import * as svc from './topics.service';

export async function getTopics(req: Request, res: Response) {
  try {
    const data = await svc.getTopicsBySubject(req.params.subjectId!);
    return res.json(data);
  } catch (err) {
    console.error('[topics]', err);
    return res.status(500).json({ error: 'Failed to fetch topics' });
  }
}

export async function createTopic(req: Request, res: Response) {
  try {
    const { name, description, order_index } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const topic = await svc.createTopic({
      subject_id: req.params.subjectId!,
      name, description, order_index,
      created_by: req.user!.id,
    });
    return res.status(201).json(topic);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Topic name already exists in this subject' });
    console.error('[topics]', err);
    return res.status(500).json({ error: 'Failed to create topic' });
  }
}

export async function updateTopic(req: Request, res: Response) {
  try {
    const topic = await svc.updateTopic(req.params.topicId!, req.body);
    return res.json(topic);
  } catch (err) {
    console.error('[topics]', err);
    return res.status(500).json({ error: 'Failed to update topic' });
  }
}

export async function deleteTopic(req: Request, res: Response) {
  try {
    await svc.softDeleteTopic(req.params.topicId!);
    return res.json({ success: true });
  } catch (err) {
    console.error('[topics]', err);
    return res.status(500).json({ error: 'Failed to delete topic' });
  }
}
