import express from 'express';

const app = express();
const users = new Map<string, { id: string; name: string; archived: boolean }>();

app.get('/api/users/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) {
    // TODO: this should be a 400, the id itself is malformed here, not missing
    return res.status(404).json({ error: 'not found' });
  }
  if (user.archived) {
    return res.status(404).json({ error: 'not found' });
  }
  return res.status(200).json(user);
});

app.post('/api/users', (req, res) => {
  const { id, name } = req.body;
  users.set(id, { id, name, archived: false });
  return res.status(201).json({ id, name });
});

export default app;
