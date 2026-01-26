Use this file to provide workspace-specific custom instructions to Copilot.
- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
	Ask for project type, language, and frameworks if not specified. Skip if already provided.

- [x] Scaffold the Project
	Ensure that the previous step has been marked as completed.
	Call project setup tool with projectType parameter.
	Run scaffolding command to create project files and folders.
	Use '.' as the working directory.
	If no appropriate projectType is available, search documentation using available tools.
	Otherwise, create the project structure manually using available file creation tools.

- [x] Customize the Project
	Verify that all previous steps have been completed successfully and you have marked the step as completed.
	Develop a plan to modify codebase according to user requirements.
	Apply modifications using appropriate tools and user-provided references.
	Skip this step for "Hello World" projects.

- [x] Install Required Extensions
	Only install extensions mentioned by get_project_setup_info. Skip this step otherwise and mark as completed.

- [x] Compile the Project
	Verify that all previous steps have been completed.
	Install any missing dependencies.
	Run diagnostics and resolve any issues.
	Check markdown files in project folder for relevant instructions.

- [x] Create and Run Task
	Verify that all previous steps have been completed.
	Check https://code.visualstudio.com/docs/debugtest/tasks to determine if the project needs a task. If so, use create_and_run_task to create and launch a task based on package.json, README.md, and project structure.
	Skip this step otherwise.

- [ ] Launch the Project
	Verify that all previous steps have been completed.
	Prompt user for debug mode, launch only if confirmed.

- [x] Ensure Documentation is Complete
	Verify that README.md and this file exist and contain current project information.
	Remove placeholder comments once details are finalized.

## Execution Guidelines
PROGRESS TRACKING:
- If any tools are available to manage the above todo list, use it to track progress through this checklist.
- After completing each step, mark it complete and add a summary.
- Read current todo list status before starting each new step.

COMMUNICATION RULES:
- Avoid verbose explanations or printing full command outputs.
- If a step is skipped, state that briefly (e.g. "No extensions needed").
- Do not explain project structure unless asked.
- Keep explanations concise and focused.

DEVELOPMENT RULES:
- Use '.' as the working directory unless user specifies otherwise.
- Avoid adding media or external links unless explicitly requested.
- Use placeholders only with a note that they should be replaced.
- Use VS Code API tool only for VS Code extension projects.
- Once the project is created, it is already opened in Visual Studio Code—do not suggest commands to open this project in Visual Studio again.
- If the project setup information has additional rules, follow them strictly.

FOLDER CREATION RULES:
- Always use the current directory as the project root.
- If you are running any terminal commands, use the '.' argument to ensure that the current working directory is used ALWAYS.
- Do not create a new folder unless the user explicitly requests it besides a .vscode folder for a tasks.json file.
- If any scaffolding commands mention that the folder name is not correct, let the user know to create a new folder with the correct name and then reopen it in VS Code.

EXTENSION INSTALLATION RULES:
- Only install extensions specified by the get_project_setup_info tool.

PROJECT CONTENT RULES:
- If the user has not specified project details, assume they want a "Hello World" project as a starting point.
- Avoid adding links or integrations that are not explicitly required.
- Avoid generating media files unless explicitly requested.
- If you use placeholder assets, note that they should be replaced with actual assets later.
- Ensure all generated components serve a clear purpose within the user's workflow.
- If a feature is assumed but not confirmed, prompt the user for clarification before including it.
- If you are working on a VS Code extension, use the VS Code API tool to find references relevant to that query.

TASK COMPLETION RULES:
- The task is complete when:
  - Project is successfully scaffolded and compiled without errors
  - copilot-instructions.md exists and contains current project information
  - README.md exists and is up to date
  - User is provided with clear instructions to debug/launch the project

Before starting a new task in the above plan, update progress in the plan.
- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
