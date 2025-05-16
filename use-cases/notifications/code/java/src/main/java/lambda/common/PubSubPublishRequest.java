package lambda.common;

import java.util.List;

public class PubSubPublishRequest {
    public List<Message> messages;

    public PubSubPublishRequest(List<Message> messages) {
        this.messages = messages;
    }

    public static class Message {
        public String data;

        public Message(String data) {
            this.data = data;
        }
    }
}
