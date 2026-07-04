export interface Story {
  id: string;
  name: string;
  avatar: string;
  color: string;
  seen: boolean;
}

export const MOCK_STORIES: Story[] = [];