import PostThreadScreen from './PostThreadScreen';

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostThreadScreen postId={id} />;
}
