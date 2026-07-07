import os
import time
import logging
from langchain_groq import ChatGroq
from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.memory import ConversationBufferWindowMemory
from langchain.tools import tool

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SarkariVLE")

# --- CONSTRAINT 3: TOOL DESCRIPTION OPTIMIZATION ---
@tool
def search_jobs_db(query: str):
    """Search latest govt jobs. Input: job or department name."""
    # Placeholder for actual DB logic
    return "UP Police Constable: 60244 Vacancies. Last date: 16 Jan."

@tool
def check_user_eligibility(user_id: str, job_id: str):
    """Compare user profile with job rules. Input: user_id, job_id."""
    return "User is eligible. Matching: 12th Pass, Age 22."

tools = [search_jobs_db, check_user_eligibility]

# --- CONSTRAINT 2 & 4: PRUNED PROMPT & CONCISE OUTPUT ---
SYSTEM_PROMPT = """
You are JOBO AI. Assist students with Indian Govt Jobs.
Rules:
- Short, peer-like Hinglish (use 'yaar', 'bhai').
- No filler ("I understand", "Searching...").
- Max 2 sentences or strict JSON if data extraction is needed.
- Provide clear, professional output. Do not repeat words, characters, or syllables. Ensure spelling is completely correct and natural. Avoid stuttering completely.
"""

# --- CONSTRAINT 1: SLIDING WINDOW MEMORY (k=2) ---
memory = ConversationBufferWindowMemory(
    memory_key="chat_history",
    return_messages=True,
    k=2
)

llm = ChatGroq(
    model="llama3-8b-8192",
    groq_api_key=os.getenv("GROQ_API_KEY", "your_key_here"),
    temperature=0.3,
    model_kwargs={"frequency_penalty": 0.6}
)

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("user", "{input}"),
    MessagesPlaceholder(variable_name="agent_scratchpad"),
])

agent = create_openai_functions_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools, memory=memory, verbose=False)

def ask_jobo(user_query):
    # --- SMART MEMORY ROUTER ---
    # Analyze if the new query is a follow-up or a fresh start
    history = memory.load_memory_variables({})["chat_history"]
    history_text = "\n".join([f"{m.type}: {m.content}" for m in history])

    if history:
        router_prompt = f"Previous Chat:\n{history_text}\n\nNew Message: {user_query}\n\nDoes this new message logically follow up on the previous conversation? Answer strictly with 'True' or 'False'."
        router_response = llm.invoke(router_prompt).content.strip()

        is_followup = "true" in router_response.lower()
        print(f"[DEBUG] Memory Router Decision: {'FOLLOW-UP (Keeping History)' if is_followup else 'NEW QUERY (Clearing History)'}")

        if not is_followup:
            memory.clear()

    # --- DEBUG LOGGING ---
    history = memory.load_memory_variables({})["chat_history"]
    history_text = "".join([m.content for m in history])

    # Precise debug log for token/length management
    total_input_len = len(SYSTEM_PROMPT) + len(user_query) + len(history_text)
    print(f"\n[DEBUG] Prompt Length: {total_input_len} chars | History Turns: {len(history)//2}")

    start_time = time.time()
    response = agent_executor.invoke({"input": user_query})
    print(f"[DEBUG] Latency: {time.time() - start_time:.2f}s\n")

    return response["output"]

if __name__ == "__main__":
    # Example usage
    user_msg = "Bhai UP Police ki vacancy kab tak aayegi?"
    print(f"User: {user_msg}")
    print(f"AI: {ask_jobo(user_msg)}")
