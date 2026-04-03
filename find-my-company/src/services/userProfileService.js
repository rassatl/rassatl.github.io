import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const USERS_COLLECTION = 'users';

export const getUserProfile = async (uid) => {
  if (!uid) return null;

  const profileRef = doc(db, USERS_COLLECTION, uid);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) return null;

  return {
    uid,
    ...profileSnap.data(),
  };
};

export const upsertUserProfile = async ({ uid, email = '', firstName = '', lastName = '', displayName = '' }) => {
  if (!uid) return;

  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();
  const fullName = displayName.trim() || `${normalizedFirstName} ${normalizedLastName}`.trim();

  const profileRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(
    profileRef,
    {
      email,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      displayName: fullName,
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    },
    { merge: true }
  );
};
