Inbox collects the things your agents need from you. When an agent is blocked on a decision or a manual step, such as approving a message before it goes out, it files an item instead of leaving a question buried in its chat. This is most useful for scheduled and unattended runs, where nobody is watching the conversation.

Open Inbox from the sidebar, where it shows a count of open items, or from the Command Center. Each item shows the agent's summary, details, and links, plus up to four buttons the agent chose:

- A button sends its message back to the same agent right away. An idle agent starts a turn with it. A busy agent picks it up as its next message, after the step it is on, so a press never interrupts work in progress. The one exception is an agent stopped on a permission prompt: since any message from you would cancel that prompt, the press waits until the prompt is answered, and the card says so. Presses for the same agent go out in the order you pressed them.
- Edit opens the agent's chat with a suggested reply already in the composer, so you can change it before sending.
- Clicking the item's title opens the agent's conversation.
- Dismiss closes the item without messaging the agent.

Closed items move to History, which records what you chose, what was sent, and when. Any item can be reopened.

## How agents use it

Every agent except background helpers gets three tools and a short instruction on when to use them:

- `inbox_add` files an item. A stable dedupe key lets a scheduled task that runs again update its open item instead of adding a duplicate.
- `inbox_list` shows what is still open and what you decided, so a later run can pick up where an earlier one left off.
- `inbox_resolve` closes an item that no longer needs you, for example because you already did it yourself, answered in the agent's chat instead of pressing a button, or the agent finished or dropped the work. Its note shows in History.

The instruction tells agents to file items only for decisions they can't make or facts they can't check themselves. You can also name the tools in your own prompts and schedules to control exactly when items are filed and what the buttons say.

## Data and limits

Items are stored on the daemon machine in `inbox/items.json` under the Paseo home directory. The plugin itself sends nothing over the network. Item contents do pass through your agents: what an agent files comes from its own conversation, and the tool results and button messages become part of the agent's conversation with its provider.

Buttons can only reach an agent that still exists on the daemon. If an agent was removed, the item reopens with an error and you can use Open chat or Dismiss instead.
