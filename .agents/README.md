# Agent skills

This project's agent skills live in the shared library at
`/Users/akamaotto/.agents/skills`.

Create a local symlink so tools can resolve them from the repo:

```bash
ln -sfn /Users/akamaotto/.agents/skills .agents/skills
```

Do not commit the symlink; it is a machine-local path.
