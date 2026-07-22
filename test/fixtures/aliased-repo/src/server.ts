import express from 'express';
import { findVisibleUser } from '@/lib/users';

const app = express();

app.get('/api/users/:id', (req, res) => {
  const user = findVisibleUser(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'not found' });
  }
  return res.status(200).json(user);
});

export default app;
