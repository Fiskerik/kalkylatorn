# AGENTS Instructions

These are the coding guidelines for this project. All contributors and assistants should apply these rules when editing code or documentation.

1. **Python Style**
   - Target Python 3.10 or later.
   - Use descriptive variable and function names.
   - Include docstrings for all public functions and classes.
   - Prefer list comprehensions and generator expressions where appropriate.

2. **Error Handling**
   - Avoid bare `except:` statements. Catch specific exceptions.
   - Do not suppress errors silently. Log or surface them as needed.

3. **Formatting**
   - Use Unix (LF) line endings for all files.
   - End each file with a single newline character.
   - Keep lines under 79 characters when practical.

4. **Documentation**
   - Update the README with any new dependencies or setup steps.
   - Comment complex logic in both Python and JavaScript files.

5. **Testing**
   - Run `python -m py_compile` on modified Python files to check syntax.
   - If tests exist, run them before committing changes.

These rules should be consulted before any code changes are proposed or implemented.

6. **Assistant Response Rules**
   - Provide a Chain-Of-Thought analysis before answering.
   - Review the attached files thoroughly. If something is missing, ask for it.
   - If unsure about any aspect of the task, request clarification. Do not guess.
   - Do nothing unless explicitly instructed. Avoid extra actions.
   - Preserve all original content except for updated sections.
   - Write code in full with no placeholders. Ask to continue if output is cut off.
   - Preserve all existing functionality. Do not modify UI elements unless requested.
