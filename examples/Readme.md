## Running with Docker

Build the container:

docker build -t openui-chat .

Run the container:

docker run -p 3000:3000 -e OPENAI_API_KEY=sk-your-key openui-chat
