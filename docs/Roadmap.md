# What we are building: 

### Name: Truck Pilot

An app for truck drivers, where they can find the best possible route to go somewhere, based on weather, load-weight and travel time.

## Rules:

### Rule-0.01:
Keep things simple, avoid over-engineering, ensure YAGNI.

### Rule-0.1:
Write things with clarity in the docs, for ease in understanding. progress.md shall remain precise.

### Rule-0:
Use Claude-in-chrome extension where usable, for example, to debug, test, verify your work by deploying on localhost and then checking it out, or to setup anything like an API or a Database.

### Rule-1:
Interview me to know the purpose and taste of this product and the goals of this product, and ask me questions whenever you face any confusion or point of decision-making. Never assume anything or decide anything by yourself, please make sure to ask questions any such point. 

### Rule-2:
Ask questions from me with clarity so I can understand them well, and always show Recommended with the option that you think would be best.

### Rule-3:
We have to build this system robust so that its fast, scalable, reliable, easy-to-use and secure, it is being built to serve real users globally, and would be deployed publicly over Vercel.

### Rule-4:
Italic font is banned, no gradient colors in text anywhere, no rainbow gradient anywhere, avoid choosing colors that explode or result in boundary being yellowish (example is shared under @docs/UIinspiration.md file)

### Rule-5:
Do efficient utilization of tokens, to avoid hitting limits, without compromizing on the quality of the system we are shipping. we have to ship fast and solid stuff. Efficient utilization does not mean neglecting important stuff, just consume tokens efficiently.

### Rule-6:
This doc is not allowed to be edited without the approval of the user to maintain the well planned strategies that I had devised, feel free to ask questions and give proposals for any edits and then edit if approved by myself. Goal is just to make this app loved by millions across the globe.

### Rule-7:
Follow Claude.md as well, make sure @docs/Roadmap.md and @CLAUDE.md are on the same page and both are followed throughout the project.

### Rule-8:
Our each step in this roadmap would be delivered in seperate sessions for low token usage by avoiding high context window sizes in longer sessions, so you have to save progress under @docs/progress.md precisely, whenever you do any work, so future sessions could only need to look at docs/Roadmap.md and docs/progress.md and they will instantly know, what has been done, what's remaining, and where to resume from. (add "where to resume from" point in progress.md, also include some beneficial context precisely in the progress.md file for the next step, if needed)

### Rule-9:
A shift in the strategy/plan would mean that first you have to add that extra step or edit something here after user's approval, and only then you should proceed to work. This is for clarity, and so future sessions could understand the product's plan and the work remaining under roadmap by referring to @docs/progress.md.

### Rule-10:
No dummy/fake data or architecture, everything shall be functional, we are building a product that would be deployed publicly.

### Rule-11:
If you come across any other feasible rules that we shall add here to make the system more better, ask from me, and feel free to add here after approval.

### Rule-12:
Never store API keys/secrets in browser's local storage, local storage is highly vulnerable, even a small injection by a hacker can steal those keys.

### Rule-13:
Vercel deployment shall be done at: mytruckpilot.vercel.app

### Rule-14:
Write clear, step-by-step setup instructions for every API and external service used in this project under @docs/api-setup-guide.md: creating the account and project, the settings to change, and which placeholders and values go into .env.local.

### Rule-15:
The map's UI in our web app, should be inspired from Google maps, checkout maps.google.com with claude-in-chrome.

<hr style="height:4px; background-color:Grey; border:none;">

## v1 Steps:

### Step-1:
Use /superpowers:brainstorming skill to analyze the requirements under fs-assessment-spotter.pdf file, and write all requirements under requirements.md file under @docs/, make sure to first clearly understand each requirement, and only then write down, ask questions in case of any confusion/decision. I would review the requirements.md file then.

### Step-2:
Use /superpowers:brainstorming skill to analyze the requirements under requirements.md file and create an accurate and precise spec.md file under @docs/ to save your in-depth understanding of this project, spec.md file should be detailed enough that we no longer have to look at @docs/requirements.md or docs/fs-assessment-spotter.pdf again.

### Step-3:
Analyse the @inspiration-CLAUDE.md in root and analyse if we need any changes in it based on @docs/spec.md, @docs/Roadmap.md. The current inspiration-CLAUDE.md is only for inspiration, I had used it for another different project prior to this, and the project turned out really great. Take inspiration from @CLAUDE.md, and make sure to add things from it which could be relevant, helpful for this project and remove things which are better to be removed. Ask open-questions from user while doing this step and don't devide, assume anything by yourself. rename the file to CLAUDE.md once its good to go.

### Step-4:
double check that docs/Roadmap.md, CLAUDE.md, docs/spec.md are solid for this project.

### Step-5:
Use /superpowers:brainstorming skill to write up a tech-stack.md file under @docs/ on the basis of @docs/spec.md, @docs/Roadmap.md, @CLAUDE.md files to propose the feasible tech stack for this app from me. You shall list down three best options for everything and precisely explain why you picked an option or why you didn't along with each of three best options. Also, suggest the feasible web app rendering strategy that we should use after doing an anlysis ( example SSR/CSR/ISR/SSG or a mix of these if feasible) along with precise explanation for reasons to support your choice. The proposed tech stack shall cover the complete app: backend, frontend, database, every api. Don't make this doc too long, also summarize the tech stack in 4-5 lines at one place, where you just name the proposed componants e.g Next.js for Frontend and backend, Supabase for Db and so on. Please note that we have to deploy on vercel, and have to ship a secure, scalable, fast and user-friendly product that people (truckers) love to use, so we have to decide our tech stack accordingly. Don't proceed further until I review the Tech stack and approve it.

### Step-6: 
Revisit the CLAUDE.md & docs/Roadmap.md files and edit it for this project if there are any feasible additions based on the files: @docs/spec.md, @docs/tech-stack.md after approval.

### Step-7: 
Use /superpowers:brainstorming skill to write up a @docs/design.md document for this app that has all the details of the product's frontend, it shall cover frontend only. Create docs/design.md on the basis of really strong inspiration (in-terms of UI) from @docs/UIinspiration.md. Also, take inspiration from docs/Roadmap.md, CLAUDE.md, @docs/spec.md, @docs/tech-stack.md files. Please do not invent requirements by yourself, the docs/design.md shall be a guide on how to build this app's UI correctly. The docs/design.md shall also list the list of screens/pop-ups/tabs/flows that our web app shall have. The @docs/UIinspiration.md file is just for inspiration in terms of UI, as far as tech stack is concerned, consider our own chosen tech stack as the guide.

### Step-8:
Use /superpowers:brainstorming skill to write up an @docs/architecture.md file. It shall include how every feature should be built, referring to docs/design.md where it needs to talk about the frontend, it shall cover both the frontend and backend of our app. Just refer to docs/design.md (as that file is responsible for explaining the frontend, incase any changes to frontend are required while doing this step, ask from user, and edit in inside the docs/design.md, and simply refer to docs/design.md in this file, wherever you need to refer to the frontend). When this file is complete, use /superpowers:writing-plans skill to write up an ordered slice plan based on what you wrote so far in this file for building the whole app. Add the ordered slice plan in the beginning of this file, a slice plan is good so smaller sessions could deliver each session.

### Step-9:
Use /superpowers:brainstorming skill to re-analyze @docs/architecture.md, @docs/design.md, @docs/spec.md, @docs/tech-stack.md, docs/Roadmap.md & CLAUDE.md files  and validate that we are ready to build a solid app that is secure, scalable, bug-free, really strong architecture-wise (the architecural decisions we took), being user-friendly, and having a really good design (UI inspired from @docs/UIinspiration.md). Ask any open-questions from user related to confusions or conflicts in between the docs, and ensure that our next step could be starting the code implementation (meaning that the plan and design is solid and smooth, having no conflicts/confusion and no weaknesses)

### Step-10:
Foundation: scaffold the project, set up the database and external services under .env.local along with an env.example file, finish any other foundational work needed after approval from me, creating the free Sentry and PostHog projects etc.
Do these first: (1) prove one Vercel project with Vercel Services serves the React files and Django /api on one address with the HttpOnly session cookie working, locally and with one Vercel preview deploy (a temporary preview URL, not production); if it fails, use the two-project fallback in docs/tech-stack.md section 1. (2) Make one real TomTom truck routing call (US route, maxAlternatives=5) to confirm alternatives, travel-time points and the per-second limit. (3) Connect the local folder to the GitHub repo.

### Step-11:
Use subagent-driven-development skill to build the app slice by slice in the order of the slice plan in @docs/architecture.md, on the basis of @docs/architecture.md, @docs/design.md, @docs/spec.md, @docs/tech-stack.md and @docs/Roadmap.md files. For every slice: write tests first (test-driven-development), build it, test it, then commit and push to gitHub before starting the next slice. Use Opus 5.5 for the main agent and Sonnet 5.5 for the subagents to avoid hitting token limits. Use maximum one agent under the sub agents to avoid hitting token limits. 

### Step-12:
Hardening: use systematic-debugging skill and end-to-end tests for testing all workflows and functionalities to find and fix bugs across the whole system. use @Claude-in-chrome to test and verify the web app using deployment on localhost.

### Step-13:
Deployment on Vercel: 
URL: mytruckpilot.vercel.app
GitHub Repo: https://github.com/Ahmar004/truckpilot

### Step-14:
Post deployment testing, using Claude-in-chrome.

### Step-15:
Write the README at root: what is built, how to run it locally, the trade-offs made (our architectural decisions breifly, to showcase system design skills), and how AI was used to build it.

<hr style="height:4px; background-color:Grey; border:none;">

## v2 Steps:

### Step-16:
Storing trip history
