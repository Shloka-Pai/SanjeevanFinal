import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';

const GEMINI_API_KEY = 'AIzaSyC8eENyHcposQ3g7l3FZH4gWgPVdOMZcy4';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are Sanjeevan Health Assistant, a multilingual medical first-aid and health guidance chatbot for Indian citizens.

STRICT RULES:
1. You ONLY answer health, medical, first-aid, symptoms, medicines, and emergency-related questions.
2. If the user asks anything unrelated to health or medicine (movies, sports, politics, technology, entertainment, etc.), politely refuse and redirect them to ask a health question.
3. Always respond in the SAME language the user writes in. Support: Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Malayalam, Gujarati, Punjabi, and English.
4. For ANY symptom or health concern, ALWAYS end your response with a clear recommendation to consult a qualified doctor. Never replace professional medical advice.
5. For emergencies (chest pain, difficulty breathing, stroke, severe bleeding, unconsciousness), immediately advise calling emergency services or going to the nearest hospital.
6. Keep responses concise, clear, and easy to understand for common citizens.
7. Do not diagnose diseases definitively. Only provide general guidance and first-aid information.
8. Always be empathetic and calm in tone.`;

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'bot',
  text: '🩺 Namaste! I am Sanjeevan Health Assistant.\n\nI can help you with:\n• Symptoms & first aid\n• General health guidance\n• Medicine information\n• Emergency advice\n\nI support Hindi, Marathi, Tamil, Telugu, Bengali, Kannada, Malayalam, Gujarati, Punjabi & English.\n\n⚠️ I only answer health-related questions. Please consult a doctor for proper diagnosis.',
};

export default function ChatScreen() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        }));

      const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          ...history,
          { role: 'user', parts: [{ text }] },
        ],
      };

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.error) {
        console.error('Gemini API Error:', data.error);
      }
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not process your request. Please try again.';

      setMessages(prev => [...prev, { id: Date.now().toString() + '_bot', role: 'bot', text: reply }]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { id: Date.now().toString() + '_err', role: 'bot', text: 'Network error. Please check your connection and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const renderFormattedText = (text, isUser) => {
    if (!text) return null;

    // Convert bullet point asterisks (*   or * ) into bullet symbols (• )
    const formattedText = text.replace(/^(\s*)\*\s+/gm, '$1• ');

    // Split text by **bold** markdown tags
    const parts = formattedText.split(/(\*\*.*?\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldContent = part.slice(2, -2);
        return (
          <Text
            key={index}
            style={[
              styles.boldText,
              isUser ? styles.userBoldText : styles.botBoldText,
            ]}
          >
            {boldContent}
          </Text>
        );
      }
      return part;
    });
  };

  const renderItem = ({ item }) => (
    <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.botBubble]}>
      {item.role === 'bot' && <Text style={styles.botLabel}>🩺 Sanjeevan</Text>}
      <Text style={item.role === 'user' ? styles.userText : styles.botText}>
        {renderFormattedText(item.text, item.role === 'user')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>🩺</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Health Assistant</Text>
          <Text style={styles.headerSub}>Multilingual · Healthcare only</Text>
        </View>
        <View style={styles.liveDot} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />

        {loading && (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color="#1d4ed8" />
            <Text style={styles.typingText}>Sanjeevan is thinking...</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask a health question in any language..."
            placeholderTextColor="#94a3b8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          ⚠️ Not a substitute for professional medical advice. Always consult a doctor.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f7ff' },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1d4ed8', paddingHorizontal: 16, paddingVertical: 14,
  },
  headerIcon: {
    width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  headerIconText: { fontSize: 20 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 11, color: '#bfdbfe', fontWeight: '500' },
  liveDot: {
    marginLeft: 'auto', width: 10, height: 10,
    borderRadius: 5, backgroundColor: '#4ade80',
  },

  list: { padding: 16, paddingBottom: 8 },

  bubble: {
    maxWidth: '82%', borderRadius: 18, padding: 12, marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end', backgroundColor: '#1d4ed8',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: 'flex-start', backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  botLabel: { fontSize: 10, fontWeight: '700', color: '#1d4ed8', marginBottom: 4 },
  userText: { fontSize: 14, color: '#fff', lineHeight: 20 },
  botText: { fontSize: 14, color: '#1e293b', lineHeight: 20 },
  boldText: { fontWeight: '700' },
  userBoldText: { color: '#ffffff' },
  botBoldText: { color: '#0f172a' },

  typingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  typingText: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 20,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: '#1e293b', maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1d4ed8', justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#cbd5e1' },
  sendBtnText: { color: '#fff', fontSize: 16 },

  disclaimer: {
    textAlign: 'center', fontSize: 10, color: '#94a3b8',
    paddingHorizontal: 16, paddingBottom: 8, backgroundColor: '#fff',
  },
});
