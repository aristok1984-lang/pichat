-- ============================================================
-- HUMANSYSTEM SETUP: Verify @humansystem, set community ownership,
-- delete @testprofile
-- Timestamp: 20260703800000
-- ============================================================

DO $$
DECLARE
    v_humansystem_id   UUID;
    v_testprofile_id   UUID;
    v_community_id     UUID;
    v_community_name   TEXT;
    v_transfer_names   TEXT[] := ARRAY['HUMAN SYSTEM', 'GREEK BROTHERHOOD', 'FREEMASONS', '144.000', 'CHOSEN ONES'];
BEGIN

    RAISE NOTICE '=== HUMANSYSTEM SETUP STARTED ===';

    -- --------------------------------------------------------
    -- STEP 1: Find @humansystem user
    -- --------------------------------------------------------
    SELECT id INTO v_humansystem_id
    FROM public.user_profiles
    WHERE username = 'humansystem'
    LIMIT 1;

    IF v_humansystem_id IS NULL THEN
        RAISE NOTICE '[WARN] User @humansystem not found. Trying is_admin=true fallback.';
        SELECT id INTO v_humansystem_id
        FROM public.user_profiles
        WHERE is_admin = true
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    IF v_humansystem_id IS NULL THEN
        RAISE EXCEPTION 'Cannot find @humansystem or any admin user. Aborting.';
    END IF;

    RAISE NOTICE 'Target user ID: %', v_humansystem_id;

    -- --------------------------------------------------------
    -- STEP 2: Mark @humansystem as verified and admin
    -- --------------------------------------------------------
    UPDATE public.user_profiles
    SET
        is_verified  = true,
        is_admin     = true,
        updated_at   = CURRENT_TIMESTAMP
    WHERE id = v_humansystem_id;

    RAISE NOTICE '[OK] @humansystem marked as verified and admin.';

    -- --------------------------------------------------------
    -- STEP 3: Transfer ownership of the 5 communities
    -- --------------------------------------------------------
    FOR v_community_id, v_community_name IN
        SELECT id, name
        FROM public.communities
        WHERE name = ANY(v_transfer_names)
    LOOP
        -- Update owner_id on the community
        UPDATE public.communities
        SET owner_id   = v_humansystem_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_community_id;

        -- Remove any existing membership for this user in this community
        DELETE FROM public.community_members
        WHERE community_id = v_community_id
          AND user_id = v_humansystem_id;

        -- Insert fresh owner membership
        INSERT INTO public.community_members (id, community_id, user_id, role, joined_at)
        VALUES (gen_random_uuid(), v_community_id, v_humansystem_id, 'owner', CURRENT_TIMESTAMP);

        -- Demote any other owner-role members to admin
        UPDATE public.community_members
        SET role = 'admin'
        WHERE community_id = v_community_id
          AND user_id <> v_humansystem_id
          AND role = 'owner';

        RAISE NOTICE '[OK] Ownership transferred for community: % (%)', v_community_name, v_community_id;
    END LOOP;

    -- Check which communities were NOT found
    DECLARE
        v_found_names TEXT[];
    BEGIN
        SELECT ARRAY_AGG(name) INTO v_found_names
        FROM public.communities
        WHERE name = ANY(v_transfer_names);

        IF v_found_names IS NULL THEN
            RAISE NOTICE '[WARN] None of the 5 target communities were found in the database.';
        ELSE
            RAISE NOTICE 'Communities found and updated: %', v_found_names;
        END IF;
    END;

    -- --------------------------------------------------------
    -- STEP 4: Delete @testprofile
    -- --------------------------------------------------------
    SELECT id INTO v_testprofile_id
    FROM public.user_profiles
    WHERE username = 'testprofile'
    LIMIT 1;

    IF v_testprofile_id IS NULL THEN
        RAISE NOTICE '[INFO] User @testprofile not found. Skipping deletion.';
    ELSE
        RAISE NOTICE 'Deleting @testprofile (ID: %)...', v_testprofile_id;

        -- Remove community memberships
        DELETE FROM public.community_members WHERE user_id = v_testprofile_id;
        -- Nullify community ownership (transfer to humansystem if they owned any)
        UPDATE public.communities SET owner_id = v_humansystem_id WHERE owner_id = v_testprofile_id;
        -- Remove follows
        DELETE FROM public.follows WHERE follower_id = v_testprofile_id OR following_id = v_testprofile_id;
        -- Remove post likes
        DELETE FROM public.post_likes WHERE user_id = v_testprofile_id;
        -- Remove post bookmarks
        DELETE FROM public.post_bookmarks WHERE user_id = v_testprofile_id;
        -- Remove reel likes
        DELETE FROM public.reel_likes WHERE user_id = v_testprofile_id;
        -- Nullify posts (preserve content, remove author link)
        UPDATE public.posts SET author_id = NULL WHERE author_id = v_testprofile_id;
        -- Nullify reels
        UPDATE public.reels SET author_id = NULL WHERE author_id = v_testprofile_id;
        -- Remove notifications
        DELETE FROM public.notifications WHERE recipient_id = v_testprofile_id OR actor_id = v_testprofile_id;
        -- Remove blocks/mutes
        DELETE FROM public.user_blocks WHERE blocker_id = v_testprofile_id OR blocked_id = v_testprofile_id;
        DELETE FROM public.user_mutes WHERE muter_id = v_testprofile_id OR muted_id = v_testprofile_id;
        -- Remove stories
        DELETE FROM public.stories WHERE user_id = v_testprofile_id;
        -- Remove pinned posts
        DELETE FROM public.pinned_posts WHERE pinned_by = v_testprofile_id OR profile_id = v_testprofile_id;
        -- Remove admin actions
        DELETE FROM public.admin_actions WHERE admin_id = v_testprofile_id;
        -- Remove content reports
        DELETE FROM public.content_reports WHERE reporter_id = v_testprofile_id OR reported_user_id = v_testprofile_id;
        -- Remove group memberships
        DELETE FROM public.group_members WHERE user_id = v_testprofile_id;
        -- Remove direct messages
        DELETE FROM public.direct_messages WHERE sender_id = v_testprofile_id OR receiver_id = v_testprofile_id;
        -- Remove comments
        UPDATE public.comments SET author_id = NULL WHERE author_id = v_testprofile_id;
        -- Finally delete the profile
        DELETE FROM public.user_profiles WHERE id = v_testprofile_id;

        RAISE NOTICE '[OK] @testprofile deleted successfully.';
    END IF;

    -- --------------------------------------------------------
    -- STEP 5: Verification summary
    -- --------------------------------------------------------
    RAISE NOTICE '';
    RAISE NOTICE '=== VERIFICATION SUMMARY ===';

    -- Confirm @humansystem is verified
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_humansystem_id AND is_verified = true) THEN
        RAISE NOTICE '[OK] @humansystem is_verified = true';
    ELSE
        RAISE NOTICE '[WARN] @humansystem verification may have failed';
    END IF;

    -- Confirm @humansystem is admin
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_humansystem_id AND is_admin = true) THEN
        RAISE NOTICE '[OK] @humansystem is_admin = true';
    ELSE
        RAISE NOTICE '[WARN] @humansystem admin grant may have failed';
    END IF;

    -- Confirm community ownerships
    FOR v_community_id, v_community_name IN
        SELECT id, name FROM public.communities WHERE name = ANY(v_transfer_names)
    LOOP
        IF (SELECT owner_id FROM public.communities WHERE id = v_community_id) = v_humansystem_id
           AND EXISTS (
               SELECT 1 FROM public.community_members
               WHERE community_id = v_community_id
                 AND user_id = v_humansystem_id
                 AND role = 'owner'
           )
        THEN
            RAISE NOTICE '[OK] % — owner confirmed for @humansystem', v_community_name;
        ELSE
            RAISE NOTICE '[WARN] % — ownership may be incomplete', v_community_name;
        END IF;
    END LOOP;

    -- Confirm @testprofile is gone
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE username = 'testprofile') THEN
        RAISE NOTICE '[OK] @testprofile has been deleted';
    ELSE
        RAISE NOTICE '[WARN] @testprofile still exists';
    END IF;

    RAISE NOTICE '=== SETUP COMPLETE ===';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Setup failed: % — SQLSTATE: %', SQLERRM, SQLSTATE;
END $$;
