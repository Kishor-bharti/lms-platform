## NOTES ABOUT THESE Commits :

1. "Epic difference":
- running client locally using `npm start` and backend on production using `NODE_ENV=production npm start` works fine, because my current `develop` branch is updated to accomodate those changes! (ie, cors allowed for localhost:3000)
- but the same code is not working if both the codebase is run in production , ie, running `npx serve -s build` in client, maybe because the code it's using the old main branch code that doesn't allow cors localhost:3000!
- logs in the production is cool! and i want them! (in both frontend and backend)