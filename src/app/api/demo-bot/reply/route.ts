import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEMO_BOT_ID = '00000000-0000-0000-0000-000000000001';

const DEMO_REPLIES = [
  'Hey! Got your message 👋',
  'Thanks for reaching out!',
  'I received your message ✓',
  'Hello there! How can I help?',
  'Message received! 📨',
  'Hi! I am the PiChat demo bot.',
  'Testing 1-2-3... all good! ✅',
  'Roger that! 👍',
  'Loud and clear!',
  'Yep, I can see your message!',
  'The messaging system is working perfectly 🎉',
  'Great, the chat is live!',
  'I reply to every message you send me 😊',
  'PiChat messaging is working great!',
  'This is a demo reply from the bot 🤖',
];

function getRandomReply(): string {
  return DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)];
}

export async function POST(req: NextRequest) {
  try {
    const { receiverId, conversationId } = await req.json();

    if (!receiverId) {
      return NextResponse.json({ error: 'receiverId is required' }, { status: 400 });
    }

    // Use service role to bypass RLS for the bot
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const content = getRandomReply();

    // If conversationId is provided, use the messages table (ChatDetailV2 flow)
    if (conversationId) {
      const { data: msgData, error: msgError } = await supabaseAdmin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: DEMO_BOT_ID,
          content,
          message_type: 'text',
          status: 'sent',
        })
        .select('id')
        .single();

      if (msgError) {
        console.error('Demo bot reply error (messages):', msgError);
        return NextResponse.json({ error: msgError.message }, { status: 500 });
      }

      // Update conversation last message
      await supabaseAdmin
        .from('conversations')
        .update({
          last_message_text: content,
          last_message_at: new Date().toISOString(),
          last_message_sender_id: DEMO_BOT_ID,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      return NextResponse.json({ success: true, messageId: msgData?.id });
    }

    // Fallback: direct_messages table (ChatDetail flow)
    const { data: msgData, error: msgError } = await supabaseAdmin
      .from('direct_messages')
      .insert({
        sender_id: DEMO_BOT_ID,
        receiver_id: receiverId,
        content,
        message_type: 'text',
        is_read: false,
      })
      .select('id')
      .single();

    if (msgError) {
      console.error('Demo bot reply error (direct_messages):', msgError);
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    // Update or create conversation
    const [p1, p2] = [DEMO_BOT_ID, receiverId].sort();
    await supabaseAdmin
      .from('conversations')
      .upsert({
        participant_one: p1,
        participant_two: p2,
        last_message_text: content,
        last_message_at: new Date().toISOString(),
        last_message_sender_id: DEMO_BOT_ID,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'participant_one,participant_two', ignoreDuplicates: false });

    return NextResponse.json({ success: true, messageId: msgData?.id });
  } catch (err: any) {
    console.error('Demo bot route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
