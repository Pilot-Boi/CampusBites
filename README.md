# Events Manager Backend

This repository contains the Django REST Framework backend for the Events Manager project. I implemented all high priority items.
The instructions below walk through setting up a local development environment so you can run the API and explore the interactive API documentation.

## Prerequisites

Before you start, make sure the following tools are available on your machine:

- **Python 3.11** (or higher)
- **pip** (usually installed with Python)
- **virtualenv** support (either the built-in `venv` module or a comparable tool)
- **Git** for cloning the repository

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/events-manager.git
   cd events-manager
   ```

2. **Create and activate a virtual environment**

   Using Python's built-in `venv` module keeps dependencies isolated from your global interpreter. The command varies slightly by platform:

   ```bash
   # Create the environment
   python -m venv .venv

   # Activate it
   # macOS / Linux
   source .venv/bin/activate

   # Windows (PowerShell)
   .venv\Scripts\Activate.ps1

   # Windows (Command Prompt)
   .venv\Scripts\activate.bat
   ```

3. **Install dependencies**

   Once the virtual environment is active, install the backend dependencies with pip:

   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Apply database migrations**

   The project ships with an SQLite database configuration, so no additional services are required. Create the schema by running:

   ```bash
   python manage.py migrate
   ```

   then run

   ```bash
   python manage.py makemigrations events
   ```

   and finally run again

   ```bash
   python manage.py migrate
   ```

5. **Run the development server**

   Start Django's built-in development server:
   
   ```bash
   python manage.py runserver
   ```
   
   By default the API will be available at http://127.0.0.1:8000/.

## Interactive API Documentation

The project includes [drf-spectacular](https://drf-spectacular.readthedocs.io/) for OpenAPI documentation.

- **Swagger UI**: http://127.0.0.1:8000/api/docs/
- **OpenAPI schema (JSON)**: http://127.0.0.1:8000/api/schema/

These routes update automatically to reflect your local code changes, making them ideal for front-end development and manual testing.

## Important Notes

In an actual deployment, we would not serve static files and templates from django, it is much better and more practical to serve them directly as static files
through nginx and not from django
