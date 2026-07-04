import HashtagFeedScreen from './HashtagFeedScreen';

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  return <HashtagFeedScreen tag={tag} />;
}
